import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGoogleAuthUrlApi } from '../services/api';

const DEFAULT_CLIENT_ID = '';

export default function GoogleSignInButton({ onSuccess, onError, text = 'Continue with Google' }) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const googleBtnContainerRef = useRef(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  // Handle credential response from Google Identity Services
  const handleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      setErrorMsg('');
      if (!response.credential) {
        throw new Error('No credential received from Google.');
      }
      const data = await loginWithGoogle(response.credential);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      const msg = err.message || 'Google Sign-In failed. Please try again.';
      setErrorMsg(msg);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let checkInterval = null;

    const initGsi = () => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Render Google's native button inside hidden or overlay container if needed
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320
          });
        } catch (e) {
          console.warn('GIS initialization notice:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(checkInterval);
          initGsi();
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [clientId]);

  // Click handler for luxury custom button - initiates canonical server-side OAuth flow
  const handleCustomGoogleClick = async () => {
    setErrorMsg('');
    setLoading(true);

    try {
      const authEndpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`;
      window.location.href = authEndpoint;
    } catch (err) {
      console.error('Failed to trigger Google login:', err);
      setErrorMsg('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Hidden GIS container to prevent duplicate button rendering */}
      <div 
        ref={googleBtnContainerRef} 
        style={{ 
          display: 'none', 
          width: 0, 
          height: 0, 
          overflow: 'hidden' 
        }} 
      />

      {/* The Single Authorized Google OAuth CTA */}
      <button
        type="button"
        id="google-signin-btn"
        onClick={handleCustomGoogleClick}
        disabled={loading}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          backgroundColor: '#161920',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          borderRadius: 'var(--radius-sm)',
          color: '#FFFFFF',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-gold)';
          e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
          e.currentTarget.style.boxShadow = '0 0 14px rgba(212, 175, 55, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.35)';
          e.currentTarget.style.backgroundColor = '#161920';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
        }}
      >
        {/* Google G Logo SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>{loading ? 'Connecting to Google...' : text}</span>
      </button>

      {errorMsg && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.85rem',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-sm)',
          color: '#f87171',
          fontSize: '11px',
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}
