/** Resolve the configured frontend origin before building OAuth redirects. */
export function getFrontendOrigin(value = process.env.FRONTEND_URL) {
  const configured = (value || 'http://localhost:5173').trim();
  // A bare deployed hostname otherwise becomes a relative Express redirect.
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(configured)
    ? configured
    : `https://${configured}`;

  let url;
  try {
    url = new URL(absolute);
  } catch {
    throw new Error('FRONTEND_URL must be an HTTP(S) frontend origin.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('FRONTEND_URL must be an HTTP(S) frontend origin without a path, credentials, query, or fragment.');
  }
  return url.origin;
}
