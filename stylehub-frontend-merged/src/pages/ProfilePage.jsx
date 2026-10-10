import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailabilityApi } from '../services/api';

export default function ProfilePage() {
  const { user, updateProfile, setChosenUsername } = useAuth();
  const navigate = useNavigate();

  // Username Section State (Initially EMPTY if user has no username)
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState({ type: '', text: '' });
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const cleanPreview = usernameInput.replace(/^@+/, '').trim();

  useEffect(() => {
    if (user?.username) {
      setUsernameInput(user.username);
    } else {
      // For new users without a username, the input must initially be EMPTY
      setUsernameInput('');
    }
  }, [user?.username]);

  // Debounced availability check
  useEffect(() => {
    const raw = usernameInput.trim();
    if (!raw) {
      setUsernameStatus({ type: '', text: '' });
      return;
    }
    const clean = raw.replace(/^@+/, '').trim();
    if (clean.length < 3) {
      setUsernameStatus({ type: 'error', text: 'Username must be at least 3 characters long.' });
      return;
    }
    if (clean.length > 30) {
      setUsernameStatus({ type: 'error', text: 'Username cannot exceed 30 characters.' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus({ type: 'error', text: 'Username can only contain letters, numbers, and underscores.' });
      return;
    }

    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailabilityApi(clean);
        if (res.available) {
          setUsernameStatus({ type: 'success', text: 'Username available.' });
        } else {
          setUsernameStatus({ type: 'error', text: res.message || 'Username already exists.' });
        }
      } catch (err) {
        setUsernameStatus({ type: 'error', text: err.message || 'Username already exists.' });
      } finally {
        setUsernameChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [usernameInput]);

  const handleUsernameChange = (e) => {
    setUsernameInput(e.target.value);
    setUsernameStatus({ type: '', text: '' });
  };

  const handleSaveUsername = async (e) => {
    e?.preventDefault();
    if (!cleanPreview) {
      setUsernameStatus({ type: 'error', text: 'Please enter a username.' });
      return;
    }
    if (usernameStatus.type !== 'success') {
      setUsernameStatus({ type: 'error', text: 'Choose an available username before continuing.' });
      return;
    }
    setUsernameSaving(true);
    try {
      await setChosenUsername(cleanPreview);
      setUsernameStatus({ type: 'success', text: 'Username saved successfully!' });
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err) {
      setUsernameStatus({ type: 'error', text: err.message || 'Username already exists.' });
    } finally {
      setUsernameSaving(false);
    }
  };

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

      {!user?.username && (
        <div
          role="status"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.15rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(212, 175, 55, 0.10)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.5
          }}
        >
          <strong style={{ color: 'var(--accent-gold)' }}>One last step:</strong>{' '}
          choose an available username below and select <strong>Save Username</strong>. Your username unlocks shopping, wishlists, and the rest of the app.
        </div>
      )}

      {/* USERNAME SECTION (MANUAL ENTRY) */}
      <div className="card" id="profile-username-section" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
            USERNAME
          </h3>
          {user?.username && (
            <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 700, padding: '0.2rem 0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ✓ ACTIVE USERNAME
            </span>
          )}
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="profile-username-input"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem'
            }}
          >
            Enter Username
          </label>
          <input
            id="profile-username-input"
            type="text"
            value={usernameInput}
            onChange={handleUsernameChange}
            placeholder="Akil"
            autoComplete="off"
            disabled={usernameSaving}
            style={inputStyle}
          />

          {/* Live Preview */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.75rem',
            padding: '0.65rem 0.85rem',
            backgroundColor: '#0E0E10',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed rgba(212, 175, 55, 0.3)'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Public username:
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--accent-gold)',
              letterSpacing: '0.04em'
            }}>
              {cleanPreview ? `@${cleanPreview}` : '@'}
            </span>
          </div>

          {/* Validation Feedback */}
          <div style={{ minHeight: '1.5rem', marginTop: '0.5rem' }}>
            {usernameChecking ? (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Checking availability...
              </span>
            ) : usernameStatus.text ? (
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: usernameStatus.type === 'success' ? 'var(--accent-gold)' : '#f87171'
              }}>
                {usernameStatus.type === 'success' ? '✓ ' : '✕ '}
                {usernameStatus.text}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            id="save-username-btn"
            className="btn btn-primary"
            onClick={handleSaveUsername}
            disabled={usernameSaving || usernameChecking || !cleanPreview || usernameStatus.type !== 'success'}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: (usernameSaving || usernameChecking || !cleanPreview || usernameStatus.type !== 'success') ? 0.45 : 1,
              cursor: (usernameSaving || usernameChecking || !cleanPreview || usernameStatus.type !== 'success') ? 'not-allowed' : 'pointer'
            }}
          >
            {usernameSaving ? 'SAVING...' : 'SAVE USERNAME'}
          </button>

          {user?.username && (
            <Link
              to="/"
              className="btn btn-secondary"
              style={{
                padding: '0.75rem 1.25rem',
                fontSize: 'var(--font-size-xs)',
                letterSpacing: '0.06em',
                textDecoration: 'none'
              }}
            >
              CONTINUE TO HOME →
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Public Identity
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
