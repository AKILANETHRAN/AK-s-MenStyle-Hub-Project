import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <span className="badge" style={{ marginBottom: '1rem' }}>404 Error</span>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Page Not Found</h1>
      <p style={{ maxWidth: '480px', margin: '0 auto 2rem' }}>
        The page you are looking for doesn't exist or has been moved within the AK'S MEN STYLE collection.
      </p>
      <Link to="/" className="btn btn-primary">
        Return Home
      </Link>
    </div>
  );
}
