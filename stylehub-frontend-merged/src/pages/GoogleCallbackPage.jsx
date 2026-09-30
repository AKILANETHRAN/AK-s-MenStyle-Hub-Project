import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleLogin, loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    async function completeAuth() {
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');
      const code = searchParams.get('code');
      const returnedState = searchParams.get('state');

      if (errorParam) {
        setError(`Google authorization was cancelled or denied: ${errorParam}`);
        setProcessing(false);
        return;
      }

      // Canonical flow: Backend completed authentication and passed local JWT
      if (token) {
        try {
          await completeGoogleLogin(token);
          navigate('/', { replace: true });
          return;
        } catch (err) {
          console.error('Failed to establish session from Google JWT:', err);
          setError(err.message || 'Google sign-in failed. Please try again.');
          setProcessing(false);
          return;
        }
      }

      // Direct code flow fallback
      if (code) {
        // CSRF state verification if state was stored
        const savedState = sessionStorage.getItem('google_oauth_state');
        if (savedState && returnedState && savedState !== returnedState) {
          sessionStorage.removeItem('google_oauth_state');
          setError('Security error: OAuth state mismatch (CSRF detected). Please try signing in again.');
          setProcessing(false);
          return;
        }
        sessionStorage.removeItem('google_oauth_state');

        try {
          const redirectUri = `${window.location.origin}/auth/google/callback`;
          await loginWithGoogle({ code, redirectUri });
          navigate('/', { replace: true });
        } catch (err) {
          console.error('Failed to complete Google OAuth login:', err);
          setError(err.message || 'Google sign-in failed. Please try again.');
          setProcessing(false);
        }
        return;
      }

      setError('No authentication token or code received from Google response.');
      setProcessing(false);
    }

    completeAuth();
  }, [searchParams, completeGoogleLogin, loginWithGoogle, navigate]);

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#161920',
        border: '1px solid var(--border-silver)',
        borderRadius: 'var(--radius-md)',
        padding: '2.5rem',
        textAlign: 'center',
        boxShadow: 'var(--shadow-card)'
      }}>
        {processing ? (
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid rgba(212, 175, 55, 0.2)',
              borderTopColor: 'var(--accent-gold)',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ color: '#FFFFFF', fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>
              Completing Google Sign In
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
              Verifying your Google credentials with AK's Men Style...
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#f87171', fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Authentication Failed
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {error}
            </p>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                fontSize: 'var(--font-size-xs)',
                letterSpacing: '0.08em',
                textDecoration: 'none'
              }}
            >
              RETURN TO LOGIN
            </Link>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
