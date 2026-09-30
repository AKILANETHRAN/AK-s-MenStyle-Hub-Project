import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to target or home
  useEffect(() => {
    if (isAuthenticated) {
      const origin = location.state?.from?.pathname || '/';
      navigate(origin, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter both your email or username and password.');
      return;
    }

    try {
      setLoading(true);
      await login(identifier.trim(), password);
      const origin = location.state?.from?.pathname || '/';
      navigate(origin, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 12rem)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1050px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        backgroundColor: '#151517',
        border: '1px solid var(--border-silver)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden'
      }}>
        {/* LEFT: Luxury Brand Statement & Editorial Visual */}
        <div style={{
          padding: '3.5rem 3rem',
          background: 'radial-gradient(circle at 10% 20%, rgba(212, 175, 55, 0.12) 0%, rgba(11, 11, 12, 0.95) 90%)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
                AK'S MEN STYLE
              </span>
            </div>

            <h1 style={{
              fontSize: '2.5rem',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '1.25rem',
              color: '#FFFFFF'
            }}>
              YOUR STYLE.<br />
              <span className="text-gold-gradient">YOUR FIT.</span><br />
              YOUR CHOICE.
            </h1>

            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: '380px',
              marginBottom: '2rem'
            }}>
              Discover refined men's fashion, visualize your fit with local AI virtual try-on, build complete looks and share your style with friends.
            </p>
          </div>

          <div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '1rem' }}>✦</span>
                <span>AI Virtual Try-On powered by local neural diffusion</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '1rem' }}>✦</span>
                <span>Tailored rule-based outfit recommendations</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '1rem' }}>✦</span>
                <span>Private style sharing, reactions and peer advice</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Elegant Login Card */}
        <div style={{
          padding: '3.5rem 3rem',
          backgroundColor: '#1D1D20',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <span className="badge badge-gold" style={{ marginBottom: '0.75rem', fontSize: '10px' }}>
              MEMBERSHIP ACCESS
            </span>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#FFFFFF' }}>
              Sign In to Your Account
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Access your personal wardrobe, virtual fittings, and wishlist.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
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
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
                color: 'var(--text-secondary)'
              }}>
                EMAIL OR USERNAME
              </label>
              <input
                type="text"
                id="login-identifier-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com or @username"
                required
                autoFocus
                className="form-input"
                style={{
                  padding: '0.85rem 1rem',
                  fontSize: 'var(--font-size-sm)'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)'
                }}>
                  PASSWORD
                </label>
              </div>
              <input
                type="password"
                id="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="form-input"
                style={{
                  padding: '0.85rem 1rem',
                  fontSize: 'var(--font-size-sm)'
                }}
              />
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              className="btn btn-primary"
              disabled={loading}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.95rem',
                fontSize: 'var(--font-size-sm)',
                letterSpacing: '0.08em'
              }}
            >
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
          </form>

          {/* Luxury Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.75rem 0 1.25rem',
            gap: '1rem'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)'
            }}>
              OR CONTINUE WITH
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          {/* The Single Authorized Google OAuth CTA */}
          <GoogleSignInButton
            text="Continue with Google"
            onSuccess={() => {
              const origin = location.state?.from?.pathname || '/';
              navigate(origin, { replace: true });
            }}
          />

          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)'
          }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--accent-gold)',
                textDecoration: 'none',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}
            >
              CREATE ACCOUNT
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
