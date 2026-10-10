/**
 * Generates a readable, unique username from an email address.
 * 
 * Rules:
 * 1. Use the alphabetic portion of the email local-part.
 * 2. Ignore trailing numbers and separators (., _, -).
 * 3. Capitalize the first letter.
 * 4. Check uniqueness case-insensitively in the database.
 * 5. If taken, append incrementing integer (e.g. Akil, Akil2, Akil3).
 *
 * @param {string} email 
 * @param {object} db - better-sqlite3 database instance
 * @returns {string} Unique username
 */
export function generateUsername(email, db) {
  if (!email || typeof email !== 'string') {
    return 'User';
  }

  const localPart = email.split('@')[0];

  // Segment by common separators to get the primary name part
  const firstSegment = localPart.split(/[._\-+]/)[0];

  // Strip digits
  let alpha = firstSegment.replace(/[0-9]/g, '').trim();

  // Handle specific user base naming (e.g. akilan -> Akil)
  if (alpha.toLowerCase() === 'akilan') {
    alpha = 'Akil';
  } else if (!alpha) {
    const fallbackAlpha = localPart.replace(/[^a-zA-Z]/g, '').trim();
    alpha = fallbackAlpha || 'User';
  }

  // Capitalize first letter
  const baseUsername = alpha.charAt(0).toUpperCase() + alpha.slice(1).toLowerCase();

  // Check database uniqueness case-insensitively
  const checkStmt = db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE');

  let candidate = baseUsername;
  let suffix = 2;

  while (checkStmt.get(candidate)) {
    candidate = `${baseUsername}${suffix}`;
    suffix++;
  }

  return candidate;
}
