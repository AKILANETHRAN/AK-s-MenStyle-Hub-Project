import React from 'react';
import { Link } from 'react-router-dom';

export default function CheckoutPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge" style={{ marginBottom: '0.75rem' }}>Secure Checkout</span>
        <h1>Checkout</h1>
        <p>Complete your order securely.</p>
      </div>

      <div className="card">
        <h3>Checkout Placeholder</h3>
        <p style={{ margin: '0.5rem 0 1.5rem', fontSize: 'var(--font-size-sm)' }}>
          Checkout process, shipping information, and payment gateway integration will arrive in future phases.
        </p>
        <Link to="/orders" className="btn btn-secondary">
          View Orders (/orders)
        </Link>
      </div>
    </div>
  );
}
