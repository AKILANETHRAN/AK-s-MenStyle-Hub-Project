import nodemailer from 'nodemailer';
import { getMessageTemplate, renderMessageTemplate } from './messageTemplateService.js';
import db from '../config/database.js';

/**
 * Safe email configuration inspector.
 * IMPORTANT: Never exposes SMTP_PASS or any secret.
 */
export function getEmailConfig() {
  const isEnabled = process.env.EMAIL_ENABLED === 'true';
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || process.env.GMAIL_SENDER_EMAIL || 'akmensstylehub@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'akmensstylehub@gmail.com';
  const fromName = process.env.EMAIL_FROM_NAME || "AK'S MEN STYLE";

  const isConfigured = Boolean(
    host &&
    port > 0 &&
    user &&
    user.includes('@') &&
    pass &&
    pass.trim().length > 0 &&
    from &&
    from.includes('@')
  );

  return {
    isEnabled,
    isConfigured,
    host,
    port,
    secure,
    user,
    from,
    fromName
  };
}

/**
 * Creates a Nodemailer transport with the current backend SMTP configuration.
 */
function createSmtpTransporter() {
  const config = getEmailConfig();

  // Legacy OAuth2 fallback if explicitly provided
  const gmailClientId = process.env.GMAIL_CLIENT_ID;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config.user,
        clientId: gmailClientId,
        clientSecret: gmailClientSecret,
        refreshToken: gmailRefreshToken
      }
    });
  }

  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: pass
    },
    tls: {
      rejectUnauthorized: true
    }
  });
}

/**
 * Verifies Nodemailer SMTP connection without sending any email.
 * Safe: Never leaks or logs passwords.
 */
export async function verifySmtpConnection() {
  const config = getEmailConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'SMTP credentials not configured in environment.'
    };
  }

  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();
    return {
      success: true,
      status: 'VERIFIED',
      message: 'SMTP connection verified successfully.'
    };
  } catch (err) {
    const safeError = String(err.message || 'SMTP verification failed')
      .replace(/pass(word)?\s*[:=]\s*[^\s]+/gi, '***');
    return {
      success: false,
      status: 'FAILED',
      message: safeError
    };
  }
}

/**
 * Record an email communication delivery attempt in PostgreSQL audit table.
 * Never stores credentials.
 */
export async function recordEmailDelivery(purchaseId, userId, status, recipient = null, providerMessageId = null, errorMessage = null, eventType = 'PURCHASE_SUCCESS', subject = null) {
  try {
    // Sanitize any potential secrets from error message
    let safeError = null;
    if (errorMessage) {
      safeError = String(errorMessage)
        .replace(/pass(word)?\s*[:=]\s*[^\s]+/gi, 'password=***')
        .slice(0, 500);
    }

    (await db.prepare(`
      INSERT INTO notification_deliveries (
        purchase_id, user_id, channel, status, recipient, provider_message_id, error_message, event_type, subject, created_at
      ) VALUES (?, ?, 'EMAIL', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      purchaseId,
      userId,
      status,
      recipient,
      providerMessageId,
      safeError,
      eventType,
      subject
    ));
  } catch (err) {
    console.error('[EMAIL AUDIT] Failed to record delivery log:', err.message);
  }
}

/**
 * Format multilingual email templates (English & Tamil) for Single, Outfit Combo, and Cart purchases.
 * Brand Aesthetic: Rich black (#0a0c10), card (#12151b), gold (#d4af37), silver (#cbd5e1), white (#ffffff).
 * Strictly avoids: courier, tracking numbers, shipping status, delivery ETA, cancellation.
 */
export function generatePurchaseEmailTemplates({ purchase, user, items = [], cartReward = null, language = 'en' }) {
  const isTamil = language === 'ta';
  const fullName = user.fullName || user.full_name || purchase.delivery_name || (isTamil ? 'அன்பான வாடிக்கையாளர்' : 'Customer');
  const deliveryName = purchase.delivery_name || fullName;
  const deliveryAddress = purchase.delivery_address || '';
  const city = purchase.delivery_city || '';
  const state = purchase.delivery_state || '';
  const pincode = purchase.delivery_pincode || '';
  const totalAmount = purchase.total_amount;
  const isCombo = purchase.purchase_type === 'COMBO';
  const isCart = Boolean(cartReward && cartReward.percentage > 0) || items.length > 1;

  let subject = '';
  let heading = '';
  let itemsHtml = '';
  let itemsText = '';
  let breakdownHtml = '';
  let breakdownText = '';

  if (isTamil) {
    if (isCombo && !cartReward) {
      subject = `AK'S MEN STYLE — ஆடைத் தொகுப்பு வாங்குதல் வெற்றிகரமாக முடிந்தது`;
      heading = `✓ முழு ஆடைத் தொகுப்பு வாங்குதல் வெற்றிகரமாக முடிந்தது`;
    } else {
      subject = `AK'S MEN STYLE — வாங்குதல் வெற்றிகரமாக முடிந்தது`;
      heading = `✓ வாங்குதல் வெற்றிகரமாக முடிந்தது`;
    }
  } else {
    if (isCombo && !cartReward) {
      subject = `AK'S MEN STYLE — Outfit Purchase Successful`;
      heading = `✓ COMPLETE OUTFIT PURCHASE SUCCESSFUL`;
    } else {
      subject = `AK'S MEN STYLE — Purchase Successful`;
      heading = `✓ PURCHASE SUCCESSFUL`;
    }
  }

  // Purchased items formatting
  items.forEach((it) => {
    const qty = it.quantity || 1;
    const price = it.unit_price || it.price || 0;
    const lineTotal = it.line_total || (qty * price);
    const prodName = it.product_name || it.name || (isTamil ? 'ஆடைப் பொருள்' : 'Fashion Apparel');
    const size = it.size ? String(it.size).trim() : null;

    if (size) {
      if (isTamil) {
        itemsText += `• ${prodName}\n  அளவு: ${size}\n  எண்ணிக்கை: ${qty}\n  விலை: ₹${price}\n`;
      } else {
        itemsText += `• ${prodName}\n  Size: ${size}\n  Quantity: ${qty}\n  Price: ₹${price}\n`;
      }
    } else {
      if (isTamil) {
        itemsText += `• ${prodName}\n  எண்ணிக்கை: ${qty}\n  விலை: ₹${price}\n`;
      } else {
        itemsText += `• ${prodName}\n  Quantity: ${qty}\n  Price: ₹${price}\n`;
      }
    }

    itemsHtml += `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #262a33; color: #ffffff; font-size: 14px;">
          <strong>${prodName}</strong>
          ${size ? `<div style="font-size: 12px; color: #d4af37; margin-top: 3px; font-weight: 600;">${isTamil ? 'அளவு' : 'Size'}: ${size}</div>` : ''}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #262a33; color: #cbd5e1; font-size: 14px; text-align: center;">
          ${qty}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #262a33; color: #cbd5e1; font-size: 14px; text-align: right;">
          ₹${price}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #262a33; color: #d4af37; font-weight: 700; font-size: 14px; text-align: right;">
          ₹${lineTotal}
        </td>
      </tr>
    `;
  });

  // Buy More Save More Reward Section
  if (cartReward && cartReward.percentage > 0) {
    const subtotal = purchase.subtotal || cartReward.subtotal || totalAmount;
    const rewardPercent = purchase.cart_reward_percent || cartReward.percentage;
    const rewardAmount = purchase.cart_reward_amount || cartReward.rewardAmount;

    if (isTamil) {
      breakdownText = `
கூட்டுத் தொகை: ₹${subtotal}
வாங்கிச் சேமியுங்கள் சலுகை: ${rewardPercent}% தள்ளுபடி
சேமிப்பு: -₹${rewardAmount}
இறுதி மொத்தம்: ₹${totalAmount}
`;
      breakdownHtml = `
        <div style="background-color: #1a1e27; border: 1px solid #262a33; border-radius: 6px; padding: 14px 18px; margin: 18px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #cbd5e1; padding: 4px 0;">கூட்டுத் தொகை:</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right; padding: 4px 0;">₹${subtotal}</td>
            </tr>
            <tr>
              <td style="color: #10b981; padding: 4px 0;">வாங்கிச் சேமியுங்கள் (${rewardPercent}% தள்ளுபடி):</td>
              <td style="color: #10b981; font-weight: 600; text-align: right; padding: 4px 0;">-₹${rewardAmount}</td>
            </tr>
            <tr>
              <td style="color: #d4af37; font-weight: 700; font-size: 15px; padding-top: 8px; border-top: 1px solid #262a33;">இறுதி மொத்தம்:</td>
              <td style="color: #d4af37; font-weight: 800; font-size: 16px; text-align: right; padding-top: 8px; border-top: 1px solid #262a33;">₹${totalAmount}</td>
            </tr>
          </table>
        </div>
      `;
    } else {
      breakdownText = `
Subtotal: ₹${subtotal}
Buy More, Save More: ${rewardPercent}% OFF
Savings: -₹${rewardAmount}
Final Total: ₹${totalAmount}
`;
      breakdownHtml = `
        <div style="background-color: #1a1e27; border: 1px solid #262a33; border-radius: 6px; padding: 14px 18px; margin: 18px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #cbd5e1; padding: 4px 0;">Subtotal:</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right; padding: 4px 0;">₹${subtotal}</td>
            </tr>
            <tr>
              <td style="color: #10b981; padding: 4px 0;">Buy More, Save More (${rewardPercent}% OFF):</td>
              <td style="color: #10b981; font-weight: 600; text-align: right; padding: 4px 0;">-₹${rewardAmount}</td>
            </tr>
            <tr>
              <td style="color: #d4af37; font-weight: 700; font-size: 15px; padding-top: 8px; border-top: 1px solid #262a33;">Final Total:</td>
              <td style="color: #d4af37; font-weight: 800; font-size: 16px; text-align: right; padding-top: 8px; border-top: 1px solid #262a33;">₹${totalAmount}</td>
            </tr>
          </table>
        </div>
      `;
    }
  }

  // Plain Text Version
  let text = '';
  if (isTamil) {
    text = `AK'S MEN STYLE

${heading}

வணக்கம் ${fullName},

உங்கள் வாங்குதல் வெற்றிகரமாக உறுதிப்படுத்தப்பட்டுள்ளது.

${isCombo ? 'வாங்கிய ஆடைத் தொகுப்பு:' : (items.length === 1 ? 'வாங்கிய பொருள்:' : 'வாங்கிய பொருட்கள்:')}

${itemsText.trim()}

${breakdownText ? breakdownText.trim() : `மொத்தம்:\n₹${totalAmount}`}

டெலிவரி பெறுநர்:
${deliveryName}

முகவரி:
${deliveryAddress}
${city}, ${state} - ${pincode}

AK'S MEN STYLE-ஐ பயன்படுத்தியதற்கு நன்றி.
இந்த வாங்குதல் AK'S MEN STYLE தளம் வழியாக மேற்கொள்ளப்பட்டது.
`;
  } else {
    text = `AK'S MEN STYLE

${heading}

Hi ${fullName},

Your purchase has been successfully confirmed.

${isCombo ? 'PURCHASED OUTFIT' : (items.length === 1 ? 'PURCHASED PRODUCT' : 'PURCHASED ITEMS')}

${itemsText.trim()}

${breakdownText ? breakdownText.trim() : `TOTAL:\n₹${totalAmount}`}

DELIVERY OWNER

${deliveryName}

DELIVERY ADDRESS

${deliveryAddress}
${city}
${state} - ${pincode}

Thank you for shopping with AK'S MEN STYLE.

This purchase was made through the AK'S MEN STYLE platform.
`;
  }

  // Premium Luxury HTML Version
  const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0c10; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #12151b; border: 1px solid #262a33; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">

          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #161922 0%, #0d0f14 100%); padding: 26px 30px; text-align: center; border-bottom: 2px solid #d4af37;">
              <span style="font-size: 11px; letter-spacing: 0.25em; color: #d4af37; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 6px;">
                HAUTE COUTURE & READY-TO-WEAR
              </span>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.08em; color: #ffffff; text-transform: uppercase;">
                AK'S MEN STYLE
              </h1>
            </td>
          </tr>

          <!-- Confirmation Status Banner -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center;">
              <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background-color: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-size: 24px; margin-bottom: 14px;">
                ✓
              </div>
              <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff;">
                ${heading}
              </h2>
              <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
                ${isTamil ? `வணக்கம் <strong>${fullName}</strong>, உங்கள் வாங்குதல் வெற்றிகரமாக உறுதிப்படுத்தப்பட்டுள்ளது.` : `Hi <strong>${fullName}</strong>, your purchase has been successfully confirmed.`}
              </p>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 10px 30px;">
              <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.1em; color: #d4af37; text-transform: uppercase; margin-bottom: 10px;">
                ${isTamil ? (isCombo ? 'வாங்கிய ஆடைத் தொகுப்பு' : (items.length === 1 ? 'வாங்கிய பொருள்' : 'வாங்கிய பொருட்கள்')) : (isCombo ? 'PURCHASED OUTFIT' : (items.length === 1 ? 'PURCHASED PRODUCT' : 'PURCHASED ITEMS'))}
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #262a33; border-radius: 6px; overflow: hidden; background-color: #0f1117;">
                <thead>
                  <tr style="background-color: #1a1e27;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; border-bottom: 1px solid #262a33;">${isTamil ? 'பொருள்' : 'Item'}</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; border-bottom: 1px solid #262a33;">${isTamil ? 'எண்ணிக்கை' : 'Qty'}</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; border-bottom: 1px solid #262a33;">${isTamil ? 'விலை' : 'Price'}</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; border-bottom: 1px solid #262a33;">${isTamil ? 'தொகை' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              ${breakdownHtml}

              ${!breakdownHtml ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-top: 1px solid #262a33; margin-top: 14px;">
                  <span style="font-size: 14px; font-weight: 600; color: #cbd5e1;">${isTamil ? 'மொத்தம்:' : 'TOTAL:'}</span>
                  <span style="font-size: 18px; font-weight: 800; color: #d4af37;">₹${totalAmount}</span>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Delivery Snapshot -->
          <tr>
            <td style="padding: 15px 30px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #161922; border: 1px solid #262a33; border-radius: 6px; padding: 16px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #d4af37; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
                      ${isTamil ? 'டெலிவரி பெறுநர்' : 'DELIVERY OWNER'}
                    </span>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                      ${deliveryName}
                    </div>
                  </td>
                  <td width="50%" valign="top" style="padding-left: 12px; border-left: 1px solid #262a33;">
                    <span style="font-size: 11px; font-weight: 700; color: #d4af37; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
                      ${isTamil ? 'டெலிவரி முகவரி' : 'DELIVERY ADDRESS'}
                    </span>
                    <div style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                      ${deliveryAddress}<br>
                      ${city}${city && state ? ', ' : ''}${state}${pincode ? ` - ${pincode}` : ''}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Safe Action Link -->
          <tr>
            <td style="padding: 10px 30px 24px 30px; text-align: center;">
              <a href="http://localhost:5173/purchases" target="_blank" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #d4af37 0%, #b89326 100%); color: #0a0c10; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase;">
                ${isTamil ? 'வாங்குதல் வரலாற்றைப் பார்க்கவும்' : 'View Purchases'}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0d12; padding: 20px 30px; text-align: center; border-top: 1px solid #1a1e27;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">
                ${isTamil ? 'AK\'S MEN STYLE-ஐ பயன்படுத்தியதற்கு நன்றி.' : 'Thank you for shopping with AK\'S MEN STYLE.'}
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                ${isTamil ? 'இந்த வாங்குதல் AK\'S MEN STYLE தளம் வழியாக மேற்கொள்ளப்பட்டது.' : 'This purchase was made through the AK\'S MEN STYLE platform.'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return {
    subject,
    text,
    html
  };
}

/**
 * Core sendEmail function meeting all specification requirements:
 * - validates recipient
 * - validates subject
 * - sends HTML and text content
 * - uses backend SMTP configuration
 * - returns safe delivery information
 * - never exposes credentials
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  purchaseId = null,
  eventType = 'PURCHASE_SUCCESS',
  userId = null
}) {
  // 1. Validate Recipient
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'FAILED', to, null, 'Invalid recipient email address', eventType, subject));
    }
    return {
      status: 'FAILED',
      message: 'Invalid recipient email address.'
    };
  }

  // 2. Validate Subject
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'FAILED', to, null, 'Subject is required', eventType, subject));
    }
    return {
      status: 'FAILED',
      message: 'Subject is required.'
    };
  }

  const config = getEmailConfig();

  // 3. Configuration Check
  if (!config.isConfigured) {
    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'NOT_CONFIGURED', to, null, 'SMTP credentials not configured in environment', eventType, subject));
    }
    return {
      status: 'NOT_CONFIGURED',
      message: 'Email service credentials not configured in environment.'
    };
  }

  // 4. Simulated Mode Check (EMAIL_ENABLED=false)
  if (!config.isEnabled) {
    const simulatedId = `simulated-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'SIMULATED', to, simulatedId, 'Email simulated (EMAIL_ENABLED=false)', eventType, subject));
    }
    return {
      status: 'SIMULATED',
      messageId: simulatedId,
      message: 'Email delivery simulated (EMAIL_ENABLED=false).'
    };
  }

  // 5. Real SMTP Dispatch via Nodemailer
  try {
    const transporter = createSmtpTransporter();

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to: to.trim(),
      subject: subject.trim(),
      text: text || '',
      html: html || ''
    });

    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'SENT', to, info.messageId, null, eventType, subject));
    }

    return {
      status: 'SENT',
      messageId: info.messageId
    };
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send email via SMTP:', err.message);
    if (purchaseId && userId) {
      (await recordEmailDelivery(purchaseId, userId, 'FAILED', to, null, err.message, eventType, subject));
    }
    return {
      status: 'FAILED',
      message: err.message
    };
  }
}

/**
 * Authoritative Purchase Success Email Dispatcher:
 * - Resolves recipient strictly from authenticated user in PostgreSQL (req.userId)
 * - Checks communication preference (email_notifications)
 * - Checks idempotency to prevent duplicate sends on refresh / navigation
 * - Formats multilingual email (EN / TA)
 * - Never rolls back purchase on email failure
 */
export async function sendPurchaseSuccessEmail(purchaseId, userId, { forceResend = false } = {}) {
  try {
    // 1. Authoritative User Lookup from PostgreSQL (Strict Recipient Security)
    const user = (await db.prepare(`
      SELECT id, username, full_name AS fullName, email, phone,
             COALESCE(email_notifications, 1) AS email_notifications,
             COALESCE(language_preference, 'en') AS language_preference
      FROM users
      WHERE id = ?
    `).get(userId));

    if (!user) {
      return { status: 'FAILED', message: 'User not found in database.' };
    }

    const recipient = user.email;

    // 2. Email Preference Check
    if (user.email_notifications === 0) {
      (await recordEmailDelivery(purchaseId, userId, 'DISABLED', recipient, null, 'Email notifications disabled in user settings'));
      return { status: 'DISABLED', message: 'Email notifications disabled in user settings.' };
    }

    if (!recipient || !recipient.includes('@')) {
      (await recordEmailDelivery(purchaseId, userId, 'FAILED', recipient, null, 'Invalid user email on profile'));
      return { status: 'FAILED', message: 'No valid email address found on user profile.' };
    }

    // 3. Idempotency Protection:
    // If not forced resend, check if email was already SENT or SIMULATED for this purchase
    if (!forceResend) {
      const existingDelivery = (await db.prepare(`
        SELECT status, provider_message_id, created_at
        FROM notification_deliveries
        WHERE purchase_id = ? AND channel = 'EMAIL' AND status IN ('SENT', 'SIMULATED')
        ORDER BY id DESC LIMIT 1
      `).get(purchaseId));

      if (existingDelivery) {
        return {
          status: existingDelivery.status,
          messageId: existingDelivery.provider_message_id,
          reused: true,
          message: 'Email notification already delivered for this purchase.'
        };
      }
    }

    // 4. Fetch Purchase Details and Items Authoritatively from PostgreSQL
    const purchase = (await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId));
    if (!purchase) {
      return { status: 'FAILED', message: 'Purchase record not found.' };
    }

    const items = (await db.prepare(`
      SELECT pi.*, p.name AS product_name, p.image AS product_image, p.price, p.cloth_type
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchaseId));

    purchase.items = items;

    // Cart Reward Details
    let cartReward = null;
    if (purchase.cart_reward_percent && purchase.cart_reward_percent > 0) {
      cartReward = {
        percentage: purchase.cart_reward_percent,
        rewardAmount: purchase.cart_reward_amount,
        subtotal: purchase.subtotal
      };
    }

    // 5. Generate Multilingual Content (EN or TA)
    let { subject, html, text } = generatePurchaseEmailTemplates({
      purchase,
      user,
      items,
      cartReward,
      language: user.language_preference || 'en'
    });

    const customBody = (await getMessageTemplate('EMAIL'));
    if (customBody) {
      text = renderMessageTemplate(customBody, purchase, user);
      const escaped = text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
      html = `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escaped}</div>`;
    }

    // 6. Send Email
    const result = await sendEmail({
      to: recipient,
      subject,
      html,
      text,
      purchaseId,
      eventType: 'PURCHASE_SUCCESS',
      userId
    });

    return result;
  } catch (err) {
    console.error('[EMAIL DISPATCH ERROR] Unexpected failure:', err);
    (await recordEmailDelivery(purchaseId, userId, 'FAILED', null, null, err.message));
    return {
      status: 'FAILED',
      message: err.message
    };
  }
}

export default {
  getEmailConfig,
  generatePurchaseEmailTemplates,
  sendEmail,
  sendPurchaseSuccessEmail,
  recordEmailDelivery,
  verifySmtpConnection
};
