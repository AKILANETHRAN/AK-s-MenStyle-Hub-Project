import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function OrderDetailPage() {
  const { id } = useParams();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/orders" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)' }}>
          ← Back to Orders
        </Link>
      </div>

      <div className="card">
        <span className="badge" style={{ marginBottom: '1rem' }}>Order Reference: {id}</span>
        <h2>Order Detail Placeholder</h2>
        <p style={{ margin: '0.75rem 0 1.5rem' }}>
          This route matches <code style={{ color: 'var(--accent-gold)' }}>/orders/{id}</code>.
        </p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          Full order breakdown, shipping status, and receipts will be displayed here in later phases.
        </p>
      </div>
    </div>
  );
}
