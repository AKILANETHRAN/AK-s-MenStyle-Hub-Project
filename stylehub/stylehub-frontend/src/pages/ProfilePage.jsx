import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    age: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phone: user.phone || '',
        age: user.age !== null && user.age !== undefined ? String(user.age) : '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    try {
      setSaving(true);
      await updateProfile({
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim() || null,
        age: formData.age ? Number(formData.age) : null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        pincode: formData.pincode.trim() || null
      });
      setStatusMessage({ type: 'success', text: 'Profile successfully updated and saved in SQLite!' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    outline: 'none',
    transition: 'var(--transition-smooth)'
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge" style={{ marginBottom: '0.75rem' }}>Personal Identity</span>
        <h1>Account Profile</h1>
        <p>Manage your sizing details, contact information, and delivery locations.</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System-Generated Username
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
              @{user?.username || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Account Email (Verified)
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
              {user?.email || '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1.25rem' }}>Edit Personal Details</h3>

        {statusMessage.text && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            color: statusMessage.type === 'success' ? 'var(--accent-green)' : '#f87171',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.25rem'
          }}>
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543210"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Age
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="21"
                min="13"
                max="120"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Delivery Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Fashion Street"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Chennai"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Tamil Nadu"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Pincode
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="600001"
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ marginTop: '0.5rem', alignSelf: 'flex-start', minWidth: '160px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
