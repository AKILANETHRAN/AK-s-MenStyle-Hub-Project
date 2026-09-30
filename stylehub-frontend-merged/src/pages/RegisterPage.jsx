import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    age: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password) {
      setError('Full Name, Email, and Password are required.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await register({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        age: formData.age ? Number(formData.age) : undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined
      });

      // Consistent flow: register -> authenticated session -> Home
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
    <div style={{ maxWidth: '580px', margin: '2rem auto' }}>
      <div className="card" style={{ border: '1px solid var(--border-silver)' }}>
        <span className="badge badge-gold" style={{ marginBottom: '1rem' }}>Create Account</span>
        <h2 style={{ marginBottom: '0.5rem' }}>Join AK'S MEN STYLE</h2>
        <p style={{ marginBottom: '1.75rem', fontSize: 'var(--font-size-sm)' }}>
          Experience bespoke digital styling and AI-powered fashion fittings.
        </p>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.25rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Akilanethran R"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="akilan200681@gmail.com"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Password * (min 6 characters)
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
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
              placeholder="123 Fashion Blvd"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
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
            disabled={loading}
            style={{ marginTop: '1rem', width: '100%', padding: '0.85rem' }}
          >
            {loading ? 'Creating Account...' : 'CREATE ACCOUNT'}
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
            OR SIGN UP WITH
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
        </div>

        {/* The Single Authorized Google OAuth CTA */}
        <GoogleSignInButton
          text="Continue with Google"
          onSuccess={() => navigate('/', { replace: true })}
        />

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 500 }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
