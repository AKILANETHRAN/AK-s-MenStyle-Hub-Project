import React from 'react';
import { Link } from 'react-router-dom';

export default function OrdersPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge" style={{ marginBottom: '0.75rem' }}>Order History</span>
        <h1>My Orders</h1>
        <p>Track your current orders and past purchases.</p>
      </div>

      <div className="card">
        <h3>Orders Placeholder</h3>
        <p style={{ margin: '0.5rem 0 1.5rem', fontSize: 'var(--font-size-sm)' }}>
          Order history and tracking details will be available in future phases.
        </p>
        <Link to="/orders/ord-9821" className="btn btn-secondary">
          View Sample Order Detail (/orders/:id)
        </Link>
      </div>
    </div>
  );
}
