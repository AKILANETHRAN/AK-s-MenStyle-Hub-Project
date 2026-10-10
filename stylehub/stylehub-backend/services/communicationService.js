import db from '../config/database.js';
import { sendPurchaseSuccessEmail } from './emailService.js';
import { DEFAULT_MESSAGE_TEMPLATES, getMessageTemplate, renderMessageTemplate } from './messageTemplateService.js';

/**
 * Normalizes phone number into international E.164 format (+91XXXXXXXXXX)
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/[^\d+]/g, '').trim();
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  // If 10-digit Indian phone number
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

/**
 * Record a communication delivery attempt in PostgreSQL audit table
 */
export async function recordDelivery(purchaseId, userId, channel, status, recipient = null, providerMessageId = null, errorMessage = null, eventType = 'PURCHASE_SUCCESS', subject = null) {
  try {
    let safeError = null;
    if (errorMessage) {
      safeError = String(errorMessage)
        .replace(/pass(word)?\s*[:=]\s*[^\s]+/gi, 'password=***')
        .slice(0, 500);
    }

    (await db.prepare(`
      INSERT INTO notification_deliveries (
        purchase_id, user_id, channel, status, recipient, provider_message_id, error_message, event_type, subject, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      purchaseId,
      userId,
      channel,
      status,
      recipient,
      providerMessageId,
      safeError,
      eventType,
      subject
    ));
  } catch (err) {
    console.error(`[COMMUNICATION] Failed to record delivery log for ${channel}:`, err.message);
  }
}

async function recordWhatsAppEvent(productId, eventType, recipient, status, providerMessageId = null, errorMessage = null) {
  try {
    (await db.prepare(`
      INSERT INTO whatsapp_event_deliveries (
        product_id, event_type, recipient, status, provider_message_id, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(productId, eventType, recipient, status, providerMessageId, errorMessage ? String(errorMessage).slice(0, 500) : null));
  } catch (err) {
    console.error('[WHATSAPP] Failed to record product event:', err.message);
  }
}

/**
 * Sends product-event messages only to the explicit Meta test recipient.
 * It never queries or contacts customer phone numbers.
 */
export async function sendTestProductWhatsAppEvent(product, eventType) {
  const testMode = process.env.META_WHATSAPP_TEST_MODE?.trim().toLowerCase() === 'true';
  const recipient = normalizePhone(process.env.META_WHATSAPP_TEST_RECIPIENT?.trim());

  if (!testMode || !recipient) {
    return {
      status: 'DISABLED',
      message: 'Test-mode product notifications require META_WHATSAPP_TEST_MODE=true and META_WHATSAPP_TEST_RECIPIENT.'
    };
  }

  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.META_WHATSAPP_API_VERSION?.trim();
  if (!accessToken || !phoneNumberId || !apiVersion) {
    (await recordWhatsAppEvent(product.id, eventType, recipient, 'NOT_CONFIGURED', null, 'Meta WhatsApp Cloud API credentials not configured'));
    return { status: 'NOT_CONFIGURED', message: 'Meta WhatsApp Cloud API credentials not configured.' };
  }

  const eventBody = eventType === 'DISCOUNT_ALERT'
    ? `STYLEHUB TEST MODE\n\nOffer activated for ${product.name}.\nNow ₹${product.price} — ${product.discountPercent}% OFF.\n\nThis is a Meta test-recipient notification, not a customer broadcast.`
    : `STYLEHUB TEST MODE\n\nNew arrival: ${product.name}.\nPrice: ₹${product.price}.\n\nThis is a Meta test-recipient notification, not a customer broadcast.`;

  try {
    // Free-form content is permitted in the active test conversation window.
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body: eventBody }
      })
    });
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = responseData?.error?.message || `Meta WhatsApp API request failed with status ${response.status}.`;
      (await recordWhatsAppEvent(product.id, eventType, recipient, 'FAILED', null, message));
      return { status: 'FAILED', message };
    }

    const messageId = responseData?.messages?.[0]?.id || null;
    (await recordWhatsAppEvent(product.id, eventType, recipient, 'SENT', messageId));
    return { status: 'SENT', messageId, recipient };
  } catch (err) {
    (await recordWhatsAppEvent(product.id, eventType, recipient, 'FAILED', null, err.message));
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Record in-app notification in PostgreSQL notifications table
 * Guarantees in-app notification succeeds regardless of email/SMS status.
 */
export async function recordInAppPurchaseNotification(purchaseId, userId, purchase, user) {
  try {
    const existing = (await db.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND type = 'PURCHASE_SUCCESS' AND related_id = ?
    `).get(userId, purchaseId));

    if (existing) return;

    const isTamil = user?.language_preference === 'ta';
    const total = purchase?.total_amount || 0;
    const title = isTamil ? 'வாங்குதல் உறுதிப்படுத்தப்பட்டது' : 'Purchase Confirmed';
    const message = isTamil
      ? `உங்கள் வாங்குதல் #${purchaseId} (₹${total}) வெற்றிகரமாக உறுதிப்படுத்தப்பட்டுள்ளது.`
      : `Your purchase #${purchaseId} for ₹${total} has been confirmed.`;

    (await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id, is_read, created_at)
      VALUES (?, 'PURCHASE_SUCCESS', ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(userId, title, message, purchaseId));
  } catch (err) {
    console.error('[IN-APP NOTIFICATION] Failed to create in-app notification:', err.message);
  }
}

/**
 * Send purchase confirmation Email via Nodemailer (Gmail / SMTP)
 * Delegates to centralized emailService
 */
export async function sendPurchaseEmail(purchase, user) {
  return (await sendPurchaseSuccessEmail(purchase.id, user.id));
}

/**
 * Send purchase confirmation SMS via Twilio
 */
export async function sendPurchaseSMS(purchase, user) {
  const channel = 'SMS';
  const rawPhone = user?.phone || purchase.delivery_phone;
  const recipient = normalizePhone(rawPhone);

  if (user?.sms_notifications === 0) {
    (await recordDelivery(purchase.id, user.id, channel, 'DISABLED', recipient, null, 'SMS disabled in user settings'));
    return { status: 'DISABLED', message: 'SMS notifications disabled in settings.' };
  }

  if (!recipient) {
    (await recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, 'No phone number available on user profile'));
    return { status: 'FAILED', message: 'No phone number available on profile.' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    (await recordDelivery(purchase.id, user.id, channel, 'NOT_CONFIGURED', recipient, null, 'Twilio SMS credentials not configured in environment'));
    return { status: 'NOT_CONFIGURED', message: 'Twilio SMS credentials not configured in environment.' };
  }

  try {
    const client = twilio(accountSid, authToken);

    const itemsSummary = (purchase.items || [])
      .map(it => `${it.product_name} × ${it.quantity || 1}`)
      .join(', ');

    const defaultSmsBody = `AK'S MEN STYLE

✅ Purchase Successful!

Hi ${user.fullName || purchase.delivery_name || 'Customer'},
your purchase has been confirmed.

Items:
${itemsSummary || 'Fashion Items'}

Total:
₹${purchase.total_amount}

Delivery:
${purchase.delivery_city}, ${purchase.delivery_state} - ${purchase.delivery_pincode}

Thank you for shopping with AK'S MEN STYLE.`;
    const smsTemplate = (await getMessageTemplate('SMS'));
    const smsBody = smsTemplate
      ? renderMessageTemplate(smsTemplate, purchase, user)
      : defaultSmsBody;

    const message = await client.messages.create({
      body: smsBody,
      from: fromNumber,
      to: recipient
    });

    (await recordDelivery(purchase.id, user.id, channel, 'SENT', recipient, message.sid, null));
    return { status: 'SENT', messageId: message.sid };
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    (await recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, err.message));
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Send purchase confirmation through Meta's official WhatsApp Cloud API.
 *
 * A configured template is used for business-initiated messages. Without a
 * template, Meta only accepts the free-form text within WhatsApp's active
 * customer-service window, which keeps local development testing convenient.
 */
export async function sendPurchaseWhatsApp(purchase, user) {
  const channel = 'WHATSAPP';
  const rawPhone = user?.phone || purchase.delivery_phone;
  const normalizedPhone = normalizePhone(rawPhone);
  const testMode = process.env.META_WHATSAPP_TEST_MODE?.trim().toLowerCase() === 'true';
  const testRecipient = normalizePhone(process.env.META_WHATSAPP_TEST_RECIPIENT?.trim());

  if (user?.whatsapp_notifications === 0) {
    (await recordDelivery(purchase.id, user.id, channel, 'DISABLED', normalizedPhone, null, 'WhatsApp disabled in user settings'));
    return { status: 'DISABLED', message: 'WhatsApp notifications disabled in settings.' };
  }

  if (!normalizedPhone) {
    (await recordDelivery(purchase.id, user.id, channel, 'FAILED', normalizedPhone, null, 'No phone number available on user profile'));
    return { status: 'FAILED', message: 'No phone number available on profile.' };
  }

  // During Step 1 development, never let a purchase notify an arbitrary
  // profile number. Only Meta's explicitly registered test recipient is used.
  if (testMode && (!testRecipient || normalizedPhone !== testRecipient)) {
    (await recordDelivery(purchase.id, user.id, channel, 'DISABLED', normalizedPhone, null, 'Test mode restricts WhatsApp delivery to META_WHATSAPP_TEST_RECIPIENT'));
    return { status: 'DISABLED', message: 'Test mode restricts delivery to the Meta test recipient.' };
  }

  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.META_WHATSAPP_API_VERSION?.trim();
  const templateName = process.env.META_WHATSAPP_TEMPLATE_NAME?.trim();
  const templateLanguage = process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en_US';

  if (!accessToken || !phoneNumberId || !apiVersion) {
    (await recordDelivery(purchase.id, user.id, channel, 'NOT_CONFIGURED', normalizedPhone, null, 'Meta WhatsApp Cloud API credentials not configured in environment'));
    return { status: 'NOT_CONFIGURED', message: 'Meta WhatsApp Cloud API credentials not configured in environment.' };
  }

  const recipient = normalizedPhone.replace(/^\+/, '');

  try {
    const whatsappTemplate = (await getMessageTemplate('WHATSAPP'));
    const whatsappBody = renderMessageTemplate(
      whatsappTemplate || DEFAULT_MESSAGE_TEMPLATES.WHATSAPP,
      purchase,
      user
    );

    // A Step 1 recipient can view the real order text only in an active
    // conversation window. Production continues to use approved templates.
    const messagePayload = templateName && !testMode
      ? {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage }
          }
        }
      : {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: {
            preview_url: false,
            body: whatsappBody
          }
        };

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = responseData?.error;
      const errorMessage = apiError?.message || `Meta WhatsApp API request failed with status ${response.status}.`;
      console.error('[WHATSAPP] Meta Cloud API send failed:', errorMessage);
      (await recordDelivery(purchase.id, user.id, channel, 'FAILED', normalizedPhone, null, errorMessage));
      return { status: 'FAILED', message: errorMessage };
    }

    const messageId = responseData?.messages?.[0]?.id || null;
    (await recordDelivery(purchase.id, user.id, channel, 'SENT', normalizedPhone, messageId, null));
    return { status: 'SENT', messageId };
  } catch (err) {
    console.error('[WHATSAPP] Send failed:', err.message);
    (await recordDelivery(purchase.id, user.id, channel, 'FAILED', normalizedPhone, null, err.message));
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Dispatch purchase notifications across Email, SMS, and WhatsApp with idempotency protection.
 * Critical Rule: Notification outcome MUST NOT affect purchase success.
 * In-App Notification is created authoritative post-commit.
 */
export async function dispatchPurchaseCommunications(purchaseId, userId) {
  try {
    // 1. Fetch authenticated user data authoritative from PostgreSQL
    const user = (await db.prepare(`
      SELECT id, username, full_name AS fullName, email, phone, address, city, state, pincode,
             COALESCE(email_notifications, 1) AS email_notifications,
             COALESCE(sms_notifications, 1) AS sms_notifications,
             COALESCE(whatsapp_notifications, 1) AS whatsapp_notifications,
             COALESCE(language_preference, 'en') AS language_preference
      FROM users
      WHERE id = ?
    `).get(userId));

    if (!user) {
      console.warn(`[COMMUNICATION] User ${userId} not found for purchase ${purchaseId}`);
      return {
        email: { status: 'FAILED', message: 'User not found' },
        sms: { status: 'FAILED', message: 'User not found' },
        whatsapp: { status: 'FAILED', message: 'User not found' }
      };
    }

    // 2. Fetch Purchase and items
    const purchase = (await db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId));
    if (!purchase) {
      return {
        email: { status: 'FAILED', message: 'Purchase record not found' },
        sms: { status: 'FAILED', message: 'Purchase record not found' },
        whatsapp: { status: 'FAILED', message: 'Purchase record not found' }
      };
    }

    const items = (await db.prepare(`
      SELECT pi.*, p.name AS product_name, p.cloth_type
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchaseId));

    purchase.items = items;

    // 3. Guaranteed in-app notification creation (Part 1 of Flow: Purchase -> PostgreSQL Commit -> In-App Notification -> Email Check -> Gmail)
    (await recordInAppPurchaseNotification(purchaseId, userId, purchase, user));

    // 4. Idempotency Check: if notifications have already been processed for this purchase, return recorded state
    const existingDeliveries = (await db.prepare(`
      SELECT channel, status, provider_message_id, error_message, created_at
      FROM notification_deliveries
      WHERE purchase_id = ?
    `).all(purchaseId));

    if (existingDeliveries && existingDeliveries.length > 0) {
      const summary = {
        email: { status: 'NOT_CONFIGURED' },
        sms: { status: 'NOT_CONFIGURED' },
        whatsapp: { status: 'NOT_CONFIGURED' }
      };
      for (const d of existingDeliveries) {
        if (d.channel === 'EMAIL') summary.email = { status: d.status, messageId: d.provider_message_id, error: d.error_message };
        if (d.channel === 'SMS') summary.sms = { status: d.status, messageId: d.provider_message_id, error: d.error_message };
        if (d.channel === 'WHATSAPP') summary.whatsapp = { status: d.status, messageId: d.provider_message_id, error: d.error_message };
      }
      return summary;
    }

    // 5. Parallel Dispatch with Promise.allSettled (fault-tolerant)
    const [emailRes, smsRes, whatsappRes] = await Promise.allSettled([
      (await sendPurchaseEmail(purchase, user)),
      (await sendPurchaseSMS(purchase, user)),
      (await sendPurchaseWhatsApp(purchase, user))
    ]);

    return {
      email: emailRes.status === 'fulfilled' ? emailRes.value : { status: 'FAILED', message: emailRes.reason?.message },
      sms: smsRes.status === 'fulfilled' ? smsRes.value : { status: 'FAILED', message: smsRes.reason?.message },
      whatsapp: whatsappRes.status === 'fulfilled' ? whatsappRes.value : { status: 'FAILED', message: whatsappRes.reason?.message }
    };
  } catch (err) {
    console.error('[COMMUNICATION] Unexpected error in dispatchPurchaseCommunications:', err);
    return {
      email: { status: 'FAILED', message: err.message },
      sms: { status: 'FAILED', message: err.message },
      whatsapp: { status: 'FAILED', message: err.message }
    };
  }
}

export default {
  normalizePhone,
  recordDelivery,
  recordInAppPurchaseNotification,
  sendPurchaseEmail,
  sendPurchaseSMS,
  sendPurchaseWhatsApp,
  sendTestProductWhatsAppEvent,
  dispatchPurchaseCommunications
};
