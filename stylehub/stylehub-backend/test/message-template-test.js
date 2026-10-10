import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.STYLEHUB_DB_PATH = ':memory:';
const { default: db, initDatabase } = await import('../config/database.js');
const { DEFAULT_MESSAGE_TEMPLATES, getMessageTemplates, getMessageTemplate, renderMessageTemplate, validateMessageTemplate } = await import('../services/messageTemplateService.js');

initDatabase();
assert.deepEqual(getMessageTemplates(), {
  EMAIL: DEFAULT_MESSAGE_TEMPLATES.EMAIL,
  SMS: '',
  WHATSAPP: DEFAULT_MESSAGE_TEMPLATES.WHATSAPP
});
assert.equal(getMessageTemplate('EMAIL'), '');
assert.equal(getMessageTemplate('WHATSAPP'), '');
assert.equal(validateMessageTemplate(DEFAULT_MESSAGE_TEMPLATES.EMAIL), null);
assert.equal(validateMessageTemplate(DEFAULT_MESSAGE_TEMPLATES.WHATSAPP), null);
assert.equal(validateMessageTemplate('Hi {customerName}, order {purchaseId} totals {total}.'), null);
assert.match(validateMessageTemplate('Hi {unknown}'), /Use only/);
assert.match(validateMessageTemplate(' '.repeat(2)), /spaces/);
assert.match(validateMessageTemplate('x'.repeat(2001)), /2,000/);

db.prepare('INSERT INTO message_templates (channel, body) VALUES (?, ?)')
  .run('EMAIL', 'Hi {customerName}, order {purchaseId} totals {total}.');
assert.equal(getMessageTemplate('EMAIL'), 'Hi {customerName}, order {purchaseId} totals {total}.');
assert.equal(getMessageTemplates().EMAIL, 'Hi {customerName}, order {purchaseId} totals {total}.');
assert.equal(renderMessageTemplate(getMessageTemplate('EMAIL'), {
  id: 42, total_amount: 1499, items: []
}, { fullName: 'Alex' }), 'Hi Alex, order 42 totals ₹1499.');

db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = 1").run();
const { default: app } = await import('../server.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/message-templates`;
const adminToken = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'stylehub_secure_jwt_secret_key_2026');
const userToken = jwt.sign({ userId: 2 }, process.env.JWT_SECRET || 'stylehub_secure_jwt_secret_key_2026');
try {
  assert.equal((await fetch(baseUrl)).status, 401);
  assert.equal((await fetch(baseUrl, { headers: { Authorization: `Bearer ${userToken}` } })).status, 403);
  const defaults = await fetch(baseUrl, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(defaults.status, 200);
  assert.equal((await defaults.json()).templates.WHATSAPP, DEFAULT_MESSAGE_TEMPLATES.WHATSAPP);
  const saved = await fetch(baseUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'SMS', body: 'Order {purchaseId}: {total}' })
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).templates.SMS, 'Order {purchaseId}: {total}');
  const invalid = await fetch(baseUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'SMS', body: 'Unknown {secret}' })
  });
  assert.equal(invalid.status, 400);
} finally {
  await new Promise(resolve => server.close(resolve));
}

db.close();
console.log('Message template persistence, validation, rendering and admin API passed.');
