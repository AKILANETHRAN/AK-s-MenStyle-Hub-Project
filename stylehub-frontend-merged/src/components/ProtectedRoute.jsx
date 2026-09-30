import React from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requiredRole }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            width: '2rem',
            height: '2rem',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-gold)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Authenticating AK'S MEN STYLE Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectPath = requiredRole === 'ADMIN' ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Check Role Authorization if required
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div style={{
        minHeight: '65vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#141416',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 2.5rem',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
          <span style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-full)',
            color: '#F87171',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            marginBottom: '1rem'
          }}>
            HTTP 403 FORBIDDEN
          </span>
          <h2 style={{ fontSize: '1.6rem', color: '#FFFFFF', margin: '0 0 1rem' }}>
            Administrator Access Denied
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: '2rem' }}>
            Your account (@{user?.username}) does not possess elevated system administrator privileges. Access to the executive dashboard is strictly restricted.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: 'var(--font-size-xs)' }}>
              RETURN TO HOME
            </Link>
            <Link to="/admin/login" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: 'var(--font-size-xs)' }}>
              ADMIN LOGIN
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
