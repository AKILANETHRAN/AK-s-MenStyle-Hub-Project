/** Safe public configuration. Never include provider credentials in the result. */
export function readEmailConfig(env = process.env) {
  const provider = (env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const user = env.SMTP_USER || env.GMAIL_SENDER_EMAIL || 'akmensstylehub@gmail.com';
  const from = env.EMAIL_FROM || env.SMTP_USER || 'akmensstylehub@gmail.com';
  const validFrom = from.includes('@') && !/[\r\n]/.test(from);
  const smtpConfigured = Boolean(host && port > 0 && user.includes('@') &&
    (env.SMTP_PASS || env.GMAIL_APP_PASSWORD || '').trim() && validFrom);
  const resendConfigured = Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim() && validFrom);
  return {
    provider,
    isEnabled: env.EMAIL_ENABLED === 'true',
    isConfigured: provider === 'resend' ? resendConfigured : provider === 'smtp' && smtpConfigured,
    host, port, user, from,
    secure: env.SMTP_SECURE === 'true' || port === 465,
    fromName: env.EMAIL_FROM_NAME || "AK'S MEN STYLE"
  };
}

export async function sendResendEmail(config, message, { apiKey = process.env.RESEND_API_KEY, request = fetch } = {}) {
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from: `${config.fromName.replace(/["\r\n]/g, '')} <${config.from}>`,
      to: [message.to.trim()],
      subject: message.subject.trim(),
      text: message.text || undefined,
      html: message.html || undefined
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) {
    const detail = String(result.message || `HTTP ${response.status}; no message ID returned`);
    throw new Error(`Resend email failed: ${apiKey ? detail.replaceAll(apiKey, '[redacted]') : detail}`);
  }
  return { messageId: result.id };
}
