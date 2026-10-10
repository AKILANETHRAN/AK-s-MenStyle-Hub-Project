import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readEmailConfig, sendResendEmail } from '../services/emailProvider.js';

test('Resend configuration requires credentials and an explicit sender without exposing keys', () => {
  const env = { EMAIL_PROVIDER: 'resend', EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test-secret', EMAIL_FROM: 'orders@example.invalid', SMTP_PASS: 'smtp-secret' };
  const config = readEmailConfig(env);
  assert.equal(config.isEnabled, true);
  assert.equal(config.isConfigured, true);
  assert.equal(config.provider, 'resend');
  assert.ok(!JSON.stringify(config).includes('test-secret'));
  assert.ok(!JSON.stringify(config).includes('smtp-secret'));
  assert.equal(readEmailConfig({ ...env, RESEND_API_KEY: '' }).isConfigured, false);
  assert.equal(readEmailConfig({ ...env, EMAIL_FROM: '' }).isConfigured, false);
  assert.equal(readEmailConfig({ ...env, EMAIL_PROVIDER: 'unsupported' }).isConfigured, false);
});

test('existing SMTP configuration remains supported', () => {
  const config = readEmailConfig({ EMAIL_ENABLED: 'false', SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '465', SMTP_USER: 'sender@example.invalid', SMTP_PASS: 'test-password' });
  assert.equal(config.provider, 'smtp');
  assert.equal(config.isConfigured, true);
  assert.equal(config.isEnabled, false);
  assert.equal(config.secure, true);
});

test('HTTPS email dispatch preserves recipient and content and requires a provider ID', async () => {
  const config = readEmailConfig({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'orders@example.invalid' });
  const message = { to: 'recipient@example.invalid', subject: 'Purchase confirmed', text: 'Your purchase is confirmed.', html: '<p>Confirmed</p>' };
  const request = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.to, [message.to]);
    assert.equal(payload.subject, message.subject);
    assert.equal(payload.html, message.html);
    assert.equal(payload.text, message.text);
    return new Response(JSON.stringify({ id: 'provider-test-id' }), { status: 200 });
  };
  assert.deepEqual(await sendResendEmail(config, message, { apiKey: 'test-key', request }), { messageId: 'provider-test-id' });
  for (const status of [200, 401]) {
    await assert.rejects(sendResendEmail(config, message, { apiKey: 'test-key', request: async () =>
      new Response(JSON.stringify({ message: 'Rejected' }), { status }) }), /Resend email failed/);
  }
});

test('purchase email dispatcher uses HTTPS and disabled mode never dispatches', async t => {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/email_test';
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'orders@example.invalid';
  process.env.EMAIL_ENABLED = 'true';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ id: 'purchase-provider-test-id' }), { status: 200 });
  });
  const { sendEmail } = await import('../services/emailService.js');
  const { default: db } = await import('../config/database.js');
  try {
    const result = await sendEmail({ to: 'recipient@example.invalid', subject: 'Purchase', text: 'Confirmed' });
    assert.equal(result.status, 'SENT');
    assert.equal(result.messageId, 'purchase-provider-test-id');
    process.env.EMAIL_ENABLED = 'false';
    assert.equal((await sendEmail({ to: 'recipient@example.invalid', subject: 'Purchase', text: 'Confirmed' })).status, 'SIMULATED');
    assert.equal(calls, 1);
  } finally { await db.close(); }
});
