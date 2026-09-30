import nodemailer from 'nodemailer';
import twilio from 'twilio';
import db from '../config/database.js';

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
 * Record a communication delivery attempt in SQLite
 */
function recordDelivery(purchaseId, userId, channel, status, recipient = null, providerMessageId = null, errorMessage = null) {
  try {
    db.prepare(`
      INSERT INTO notification_deliveries (
        purchase_id, user_id, channel, status, recipient, provider_message_id, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      purchaseId,
      userId,
      channel,
      status,
      recipient,
      providerMessageId,
      errorMessage ? String(errorMessage).slice(0, 500) : null
    );
  } catch (err) {
    console.error(`[COMMUNICATION] Failed to record delivery log for ${channel}:`, err.message);
  }
}

/**
 * Send purchase confirmation Email via Nodemailer (Gmail / SMTP)
 */
export async function sendPurchaseEmail(purchase, user) {
  const channel = 'EMAIL';
  const recipient = user?.email;

  if (user?.email_notifications === 0) {
    recordDelivery(purchase.id, user.id, channel, 'DISABLED', recipient, null, 'Email disabled in user settings');
    return { status: 'DISABLED', message: 'Email notifications disabled in settings.' };
  }

  if (!recipient || !recipient.includes('@')) {
    recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, 'Invalid or missing user email');
    return { status: 'FAILED', message: 'No valid email address found on profile.' };
  }

  // Check Gmail / SMTP configuration
  const gmailSender = process.env.GMAIL_SENDER_EMAIL || process.env.SMTP_USER;
  const gmailClientId = process.env.GMAIL_CLIENT_ID;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  const isConfigured = Boolean(
    (gmailSender && gmailClientId && gmailClientSecret && gmailRefreshToken) ||
    (smtpHost && smtpPass && gmailSender) ||
    (gmailSender && smtpPass)
  );

  if (!isConfigured) {
    recordDelivery(purchase.id, user.id, channel, 'NOT_CONFIGURED', recipient, null, 'Gmail/SMTP credentials not configured in environment');
    return { status: 'NOT_CONFIGURED', message: 'Email service credentials not configured in environment.' };
  }

  try {
    let transporter;
    if (gmailClientId && gmailRefreshToken) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: gmailSender,
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
          refreshToken: gmailRefreshToken
        }
      });
    } else if (smtpHost) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: gmailSender, pass: smtpPass }
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailSender, pass: smtpPass }
      });
    }

    // Format purchased items list
    const itemsList = (purchase.items || [])
      .map(it => `${it.product_name} × ${it.quantity || 1}`)
      .join('\n');

    const emailSubject = `AK'S MEN STYLE — Purchase Successful`;
    const emailBody = `AK'S MEN STYLE

Purchase Successful!

Hi ${user.fullName || purchase.delivery_name || 'Customer'},

Your purchase has been confirmed.

PURCHASED ITEMS:

${itemsList || 'Fashion Apparel × 1'}

TOTAL:
₹${purchase.total_amount}

DELIVERY OWNER:
${purchase.delivery_name}

DELIVERY ADDRESS:
${purchase.delivery_address}
${purchase.delivery_city}, ${purchase.delivery_state} - ${purchase.delivery_pincode}

Thank you for shopping with AK'S MEN STYLE.`;

    const info = await transporter.sendMail({
      from: `"AK'S MEN STYLE" <${gmailSender}>`,
      to: recipient,
      subject: emailSubject,
      text: emailBody
    });

    recordDelivery(purchase.id, user.id, channel, 'SENT', recipient, info.messageId, null);
    return { status: 'SENT', messageId: info.messageId };
  } catch (err) {
    console.error('[EMAIL] Send failed:', err.message);
    recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, err.message);
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Send purchase confirmation SMS via Twilio
 */
export async function sendPurchaseSMS(purchase, user) {
  const channel = 'SMS';
  const rawPhone = user?.phone || purchase.delivery_phone;
  const recipient = normalizePhone(rawPhone);

  if (user?.sms_notifications === 0) {
    recordDelivery(purchase.id, user.id, channel, 'DISABLED', recipient, null, 'SMS disabled in user settings');
    return { status: 'DISABLED', message: 'SMS notifications disabled in settings.' };
  }

  if (!recipient) {
    recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, 'No phone number available on user profile');
    return { status: 'FAILED', message: 'No phone number available on profile.' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    recordDelivery(purchase.id, user.id, channel, 'NOT_CONFIGURED', recipient, null, 'Twilio SMS credentials not configured in environment');
    return { status: 'NOT_CONFIGURED', message: 'Twilio SMS credentials not configured in environment.' };
  }

  try {
    const client = twilio(accountSid, authToken);

    const itemsSummary = (purchase.items || [])
      .map(it => `${it.product_name} × ${it.quantity || 1}`)
      .join(', ');

    const smsBody = `AK'S MEN STYLE

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

    const message = await client.messages.create({
      body: smsBody,
      from: fromNumber,
      to: recipient
    });

    recordDelivery(purchase.id, user.id, channel, 'SENT', recipient, message.sid, null);
    return { status: 'SENT', messageId: message.sid };
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    recordDelivery(purchase.id, user.id, channel, 'FAILED', recipient, null, err.message);
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Send purchase confirmation WhatsApp message via Twilio WhatsApp API
 */
export async function sendPurchaseWhatsApp(purchase, user) {
  const channel = 'WHATSAPP';
  const rawPhone = user?.phone || purchase.delivery_phone;
  const normalizedPhone = normalizePhone(rawPhone);

  if (user?.whatsapp_notifications === 0) {
    recordDelivery(purchase.id, user.id, channel, 'DISABLED', normalizedPhone, null, 'WhatsApp disabled in user settings');
    return { status: 'DISABLED', message: 'WhatsApp notifications disabled in settings.' };
  }

  if (!normalizedPhone) {
    recordDelivery(purchase.id, user.id, channel, 'FAILED', normalizedPhone, null, 'No phone number available on user profile');
    return { status: 'FAILED', message: 'No phone number available on profile.' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  let whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !whatsappFrom) {
    recordDelivery(purchase.id, user.id, channel, 'NOT_CONFIGURED', normalizedPhone, null, 'Twilio WhatsApp credentials not configured in environment');
    return { status: 'NOT_CONFIGURED', message: 'Twilio WhatsApp credentials not configured in environment.' };
  }

  if (!whatsappFrom.startsWith('whatsapp:')) {
    whatsappFrom = `whatsapp:${whatsappFrom}`;
  }

  const whatsappRecipient = `whatsapp:${normalizedPhone}`;

  try {
    const client = twilio(accountSid, authToken);

    const itemsSummary = (purchase.items || [])
      .map(it => `${it.product_name} × ${it.quantity || 1}`)
      .join(', ');

    const whatsappBody = `AK'S MEN STYLE

✅ Purchase Successful!

Hi ${user.fullName || purchase.delivery_name || 'Customer'},

Your purchase has been confirmed.

Items:
${itemsSummary || 'Fashion Items'}

Total:
₹${purchase.total_amount}

Delivery Owner:
${purchase.delivery_name}

Address:
${purchase.delivery_city}, ${purchase.delivery_state} - ${purchase.delivery_pincode}

Thank you for shopping with AK'S MEN STYLE.`;

    const message = await client.messages.create({
      body: whatsappBody,
      from: whatsappFrom,
      to: whatsappRecipient
    });

    recordDelivery(purchase.id, user.id, channel, 'SENT', normalizedPhone, message.sid, null);
    return { status: 'SENT', messageId: message.sid };
  } catch (err) {
    console.error('[WHATSAPP] Send failed:', err.message);
    recordDelivery(purchase.id, user.id, channel, 'FAILED', normalizedPhone, null, err.message);
    return { status: 'FAILED', message: err.message };
  }
}

/**
 * Dispatch purchase notifications across Email, SMS, and WhatsApp with idempotency protection.
 * Critical Rule: Notification outcome MUST NOT affect purchase success.
 */
export async function dispatchPurchaseCommunications(purchaseId, userId) {
  try {
    // 1. Idempotency Check: if notifications have already been processed for this purchase, return recorded state
    const existingDeliveries = db.prepare(`
      SELECT channel, status, provider_message_id, error_message, created_at
      FROM notification_deliveries
      WHERE purchase_id = ?
    `).all(purchaseId);

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

    // 2. Fetch authenticated user data authoritative from SQLite
    const user = db.prepare(`
      SELECT id, username, full_name AS fullName, email, phone, address, city, state, pincode,
             email_notifications, sms_notifications, whatsapp_notifications
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      console.warn(`[COMMUNICATION] User ${userId} not found for purchase ${purchaseId}`);
      return {
        email: { status: 'FAILED', message: 'User not found' },
        sms: { status: 'FAILED', message: 'User not found' },
        whatsapp: { status: 'FAILED', message: 'User not found' }
      };
    }

    // 3. Fetch Purchase and items
    const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId);
    if (!purchase) {
      return {
        email: { status: 'FAILED', message: 'Purchase record not found' },
        sms: { status: 'FAILED', message: 'Purchase record not found' },
        whatsapp: { status: 'FAILED', message: 'Purchase record not found' }
      };
    }

    const items = db.prepare(`
      SELECT pi.*, p.name AS product_name, p.cloth_type
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchaseId);

    purchase.items = items;

    // 4. Parallel Dispatch with Promise.allSettled (fault-tolerant)
    const [emailRes, smsRes, whatsappRes] = await Promise.allSettled([
      sendPurchaseEmail(purchase, user),
      sendPurchaseSMS(purchase, user),
      sendPurchaseWhatsApp(purchase, user)
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
