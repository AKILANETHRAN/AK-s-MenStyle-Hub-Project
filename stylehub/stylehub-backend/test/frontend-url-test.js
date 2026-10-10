import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFrontendOrigin } from '../config/frontendUrl.js';

test('bare Vercel hostname produces an absolute frontend callback', () => {
  const origin = getFrontendOrigin('ak-s-men-style-hub-project.vercel.app');
  const location = `${origin}/auth/google/callback?token=test-token`;
  const resolved = new URL(location, 'https://backend.example.com/api/auth/google/callback');
  assert.equal(resolved.origin, 'https://ak-s-men-style-hub-project.vercel.app');
  assert.equal(resolved.pathname, '/auth/google/callback');
  assert.equal(resolved.searchParams.get('token'), 'test-token');
});

test('absolute origins preserve local HTTP and normalize whitespace and trailing slash', () => {
  assert.equal(getFrontendOrigin(' https://frontend.example.com/ '), 'https://frontend.example.com');
  assert.equal(getFrontendOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(getFrontendOrigin(''), 'http://localhost:5173');
});

test('invalid frontend configuration cannot become an OAuth redirect', () => {
  for (const value of ['javascript:alert(1)', 'ftp://example.com', 'https://',
    'https://user:password@example.com', 'https://example.com/api',
    'https://example.com?next=other', 'https://example.com#fragment']) {
    assert.throws(() => getFrontendOrigin(value), /FRONTEND_URL/);
  }
});
