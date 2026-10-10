import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailabilityApi } from '../services/api';

export default function SetUsernamePage() {
  const { user, isAuthenticated, loading, setChosenUsername } = useAuth();
  const navigate = useNavigate();

  const [rawInput, setRawInput] = useState('');
  const [cleanPreview, setCleanPreview] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  // If already authenticated with a valid username, redirect to Home
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      } else if (user?.username) {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Handle input change and normalize preview
  const handleInputChange = (e) => {
    const val = e.target.value;
    setRawInput(val);
    const cleaned = val.replace(/^@+/, '').trim();
    setCleanPreview(cleaned);

    if (!cleaned) {
      setStatusMessage('');
      setIsAvailable(null);
    }
  };

  // Debounced availability check
  useEffect(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setStatusMessage('');
      setIsAvailable(null);
      return;
    }

    if (rawInput !== trimmed) {
      setStatusMessage('Username cannot contain leading or trailing spaces.');
      setIsAvailable(false);
      return;
    }

    const clean = rawInput.replace(/^@+/, '').trim();
    if (clean.length < 3) {
      setStatusMessage('Username must be at least 3 characters long.');
      setIsAvailable(false);
      return;
    }

    if (clean.length > 30) {
      setStatusMessage('Username cannot exceed 30 characters.');
      setIsAvailable(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setStatusMessage('Username can only contain letters, numbers, and underscores.');
      setIsAvailable(false);
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailabilityApi(clean);
        setIsAvailable(res.available);
        setStatusMessage(res.message);
      } catch (err) {
        setIsAvailable(false);
        setStatusMessage(err.message || 'Error verifying username availability.');
      } finally {
        setChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [rawInput]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const clean = rawInput.replace(/^@+/, '').trim();
    if (!clean) {
      setStatusMessage('Please enter a username.');
      setIsAvailable(false);
      return;
    }

    if (isAvailable === false) {
      return;
    }

    try {
      setSubmitting(true);
      await setChosenUsername(clean);
      navigate('/', { replace: true });
    } catch (err) {
      setStatusMessage(err.message || 'Failed to save username. Please try another.');
      setIsAvailable(false);
    } finally {
      setSubmitting(false);
    }
  };

  const previewDisplay = cleanPreview || 'Akil';

  return (
    <div style={{
      minHeight: 'calc(100vh - 12rem)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-silver)',
        borderRadius: 'var(--radius-lg)',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow-card)',
        textAlign: 'center'
      }}>
        {/* Luxury Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <span style={{
            height: '1px',
            width: '24px',
            backgroundColor: 'var(--accent-gold)'
          }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--accent-gold)'
          }}>
            SET YOUR USERNAME
          </span>
          <span style={{
            height: '1px',
            width: '24px',
            backgroundColor: 'var(--accent-gold)'
          }} />
        </div>

        {/* Heading & Subheading */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 0.75rem',
          letterSpacing: '-0.01em'
        }}>
          CHOOSE YOUR IDENTITY
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: 1.5,
          margin: '0 0 2rem'
        }}>
          Pick the username your friends will see when you share your style.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="username-input"
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '0.5rem'
              }}
            >
              Enter Username
            </label>
            <input
              id="username-input"
              type="text"
              value={rawInput}
              onChange={handleInputChange}
              placeholder="Akil"
              autoFocus
              autoComplete="off"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                border: isAvailable === false
                  ? '1px solid #ef4444'
                  : isAvailable === true
                  ? '1px solid var(--accent-gold)'
                  : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
            />

            {/* Live Preview */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
              padding: '0.65rem 0.85rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed rgba(212, 175, 55, 0.3)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Username will appear as:
              </span>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--accent-gold)',
                letterSpacing: '0.04em'
              }}>
                @{previewDisplay}
              </span>
            </div>

            {/* Validation Message */}
            <div style={{ minHeight: '1.5rem', marginTop: '0.5rem' }}>
              {checking ? (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Checking availability...
                </span>
              ) : statusMessage ? (
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isAvailable ? 'var(--accent-gold)' : '#f87171'
                }}>
                  {isAvailable ? '✓ ' : '✕ '}
                  {statusMessage}
                </span>
              ) : null}
            </div>
          </div>

          {/* Primary CTA Button */}
          <button
            type="submit"
            id="continue-username-btn"
            className="btn btn-primary"
            disabled={submitting || isAvailable === false || !cleanPreview}
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: (submitting || isAvailable === false || !cleanPreview) ? 'not-allowed' : 'pointer',
              opacity: (submitting || isAvailable === false || !cleanPreview) ? 0.45 : 1
            }}
          >
            {submitting ? 'SAVING IDENTITY...' : 'CONTINUE'}
          </button>
        </form>
      </div>
    </div>
  );
}
