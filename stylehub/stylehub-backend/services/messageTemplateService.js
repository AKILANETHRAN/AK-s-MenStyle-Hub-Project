import db from '../config/database.js';

export const MESSAGE_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'];
export const MESSAGE_FIELDS = ['customerName', 'purchaseId', 'items', 'total', 'deliveryName', 'deliveryAddress'];

// Editable starting text shown in the admin purchase-message editor. Email
// retains its existing formatted, multilingual delivery until an admin saves
// an override; WhatsApp uses this text for free-form delivery by default.
export const DEFAULT_MESSAGE_TEMPLATES = {
  EMAIL: `AK'S MEN STYLE

Purchase Confirmed

Hi {customerName},

Your purchase #{purchaseId} has been successfully confirmed.

Purchased items: {items}
Total: {total}

Delivery recipient: {deliveryName}
Delivery location: {deliveryAddress}

Thank you for shopping with AK'S MEN STYLE.`,
  WHATSAPP: `AK'S MEN STYLE

✅ Purchase Successful!

Hi {customerName},

Your purchase has been confirmed.

Items:
{items}

Total:
{total}

Delivery Owner:
{deliveryName}

Address:
{deliveryAddress}

Thank you for shopping with AK'S MEN STYLE.`
};

export function getMessageTemplates() {
  const rows = db.prepare('SELECT channel, body FROM message_templates').all();
  return Object.fromEntries(MESSAGE_CHANNELS.map(channel => [
    channel,
    rows.find(row => row.channel === channel)?.body || DEFAULT_MESSAGE_TEMPLATES[channel] || ''
  ]));
}

export function getMessageTemplate(channel) {
  return db.prepare('SELECT body FROM message_templates WHERE channel = ?').get(channel)?.body || '';
}

export function validateMessageTemplate(body) {
  if (typeof body !== 'string' || body.length > 2000) return 'Message must be text of at most 2,000 characters.';
  if (body && !body.trim()) return 'Message cannot contain only spaces.';
  const fields = [...body.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
  const unknown = fields.find(field => !MESSAGE_FIELDS.includes(field));
  if (unknown || body.replace(/\{[^{}]+\}/g, '').includes('{') || body.replace(/\{[^{}]+\}/g, '').includes('}')) {
    return `Use only these fields: ${MESSAGE_FIELDS.map(field => `{${field}}`).join(', ')}.`;
  }
  return null;
}

export function renderMessageTemplate(template, purchase, user) {
  const values = {
    customerName: user?.fullName || purchase?.delivery_name || 'Customer',
    purchaseId: String(purchase?.id || ''),
    items: (purchase?.items || []).map(item => `${item.product_name} × ${item.quantity || 1}`).join(', ') || 'Fashion items',
    total: `₹${purchase?.total_amount ?? 0}`,
    deliveryName: purchase?.delivery_name || '',
    deliveryAddress: [purchase?.delivery_city, purchase?.delivery_state, purchase?.delivery_pincode].filter(Boolean).join(', ')
  };
  return template.replace(/\{([^{}]+)\}/g, (_, field) => values[field] ?? '');
}
