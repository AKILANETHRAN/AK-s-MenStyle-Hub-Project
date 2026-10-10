import React from 'react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, pageSize, total, totalPages } = pagination;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, totalPages]
    .filter(number => number >= 1 && number <= totalPages))].sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.75rem' }}>
      <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      {pageNumbers.map((number, index) => (
        <React.Fragment key={number}>
          {index > 0 && number > pageNumbers[index - 1] + 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            className={`btn ${number === page ? 'btn-primary' : 'btn-secondary'}`}
            aria-label={`Page ${number}`}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        </React.Fragment>
      ))}
      <span aria-live="polite" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
        {first}–{last} of {total} · Page {page} of {totalPages}
      </span>
      <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </nav>
  );
}
