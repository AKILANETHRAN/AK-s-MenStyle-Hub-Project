import React, { useEffect, useState } from 'react';
import { fetchAdminMessageTemplatesApi, updateAdminMessageTemplateApi } from '../services/api';

const channels = [
  { id: 'EMAIL', label: 'Email' },
  { id: 'SMS', label: 'SMS' },
  { id: 'WHATSAPP', label: 'WhatsApp' }
];
const sampleFields = {
  customerName: 'Alex',
  purchaseId: '1234',
  items: 'Oxford Shirt × 1, Jeans × 1',
  total: '₹1,499',
  deliveryName: 'Alex',
  deliveryAddress: 'Chennai, Tamil Nadu, 600001'
};

function previewMessage(body) {
  return body.replace(/\{([^{}]+)\}/g, (_, field) => sampleFields[field] ?? `{${field}}`);
}

export default function AdminMessageTemplates({ token }) {
  const [templates, setTemplates] = useState({ EMAIL: '', SMS: '', WHATSAPP: '' });
  const [savedTemplates, setSavedTemplates] = useState({ EMAIL: '', SMS: '', WHATSAPP: '' });
  const [pending, setPending] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchAdminMessageTemplatesApi(token)
      .then(data => {
        setTemplates(data.templates);
        setSavedTemplates(data.templates);
      })
      .catch(error => setNotice(error.message));
  }, [token]);

  const save = async channel => {
    setPending(channel);
    setNotice('');
    try {
      const data = await updateAdminMessageTemplateApi(token, channel, templates[channel]);
      setTemplates(data.templates);
      setSavedTemplates(data.templates);
      setNotice(`${channel} message saved. Future purchase notifications will use it.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending('');
    }
  };

  return (
    <section className="card" aria-label="Purchase notification messages">
      <h2>Purchase messages</h2>
      <p>Edit what customers receive when a purchase is confirmed. Email and WhatsApp show editable starting messages; any message you previously saved is preserved. Until you save an email override, the existing formatted, language-aware email is used. Clear and save a message to return to its built-in delivery.</p>
      <p>Available fields: {'{customerName}'}, {'{purchaseId}'}, {'{items}'}, {'{total}'}, {'{deliveryName}'}, {'{deliveryAddress}'}.</p>
      <p>WhatsApp custom text applies to free-form messages in an active conversation or test mode. When a Meta approved template is configured, that approved template is sent instead.</p>
      {notice && <p role="status">{notice}</p>}
      <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
        {channels.map(channel => (
          <div key={channel.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
            <label htmlFor={`admin-message-${channel.id}`} style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>{channel.label}</label>
            <textarea
              id={`admin-message-${channel.id}`}
              className="form-input"
              rows={6}
              maxLength={2000}
              value={templates[channel.id] || ''}
              onChange={event => setTemplates(previous => ({ ...previous, [channel.id]: event.target.value }))}
              placeholder={`Leave empty to use the built-in ${channel.label} message`}
            />
            {templates[channel.id] && (
              <div style={{ marginTop: '0.75rem', padding: '0.9rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <strong style={{ fontSize: '0.8rem' }}>Preview with sample order</strong>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.4rem', fontSize: '0.85rem' }}>{previewMessage(templates[channel.id])}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <small style={{ color: 'var(--text-muted)' }}>{templates[channel.id]?.length || 0}/2000 characters</small>
              <button className="btn btn-primary" type="button" disabled={pending !== '' || templates[channel.id] === savedTemplates[channel.id]} onClick={() => save(channel.id)}>
                {pending === channel.id ? 'Saving…' : `Save ${channel.label}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
