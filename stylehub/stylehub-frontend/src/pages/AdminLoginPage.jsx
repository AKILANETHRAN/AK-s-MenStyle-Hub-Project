import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please provide both administrator email and password.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await login(cleanEmail, password);
      if (res?.user?.role !== 'ADMIN') {
        logout();
        setError('Access Denied: This account lacks administrator privileges.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid administrator credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: '#141416',
        border: '1.5px solid var(--border-gold)',
        borderRadius: 'var(--radius-lg)',
        padding: '3rem 2.5rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.15)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            padding: '0.35rem 0.9rem',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid var(--border-gold)',
            borderRadius: 'var(--radius-full)'
          }}>
            <span style={{ fontSize: '0.85rem' }}>🔒</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent-gold)'
            }}>
              RESTRICTED SYSTEM ACCESS
            </span>
          </div>

          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            margin: '0 0 0.5rem',
            color: '#FFFFFF'
          }}>
            AK'S MEN STYLE
          </h1>

          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--accent-gold)'
          }}>
            ADMIN PORTAL
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#F87171',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            marginBottom: '1.5rem',
            lineHeight: 1.4
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent-silver)',
              marginBottom: '0.5rem'
            }}>
              ADMIN EMAIL
            </label>
            <input
              type="email"
              id="admin-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@aksmenstyle.com"
              required
              style={{
                width: '100%',
                backgroundColor: '#0D0D0E',
                border: '1px solid var(--border-silver)',
                borderRadius: 'var(--radius-sm)',
                color: '#FFFFFF',
                padding: '0.85rem 1rem',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-silver)'; }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent-silver)',
              marginBottom: '0.5rem'
            }}>
              PASSWORD
            </label>
            <input
              type="password"
              id="admin-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%',
                backgroundColor: '#0D0D0E',
                border: '1px solid var(--border-silver)',
                borderRadius: 'var(--radius-sm)',
                color: '#FFFFFF',
                padding: '0.85rem 1rem',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-silver)'; }}
            />
          </div>

          <button
            type="submit"
            id="admin-login-submit-btn"
            disabled={submitting}
            style={{
              marginTop: '0.75rem',
              backgroundColor: 'var(--accent-gold)',
              color: '#0B0B0C',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.9rem',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'var(--transition-smooth)'
            }}
          >
            {submitting ? 'AUTHENTICATING...' : 'ADMIN LOGIN'}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          textAlign: 'center',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)'
        }}>
          Return to{' '}
          <Link to="/" style={{ color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 600 }}>
            Customer Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
