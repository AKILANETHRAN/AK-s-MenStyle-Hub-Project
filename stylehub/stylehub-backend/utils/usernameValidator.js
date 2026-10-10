/**
 * Centralized Username Validation & Normalization for AK'S MEN STYLE
 */

/**
 * Strips leading '@' and whitespace
 */
export function normalizeUsernameInput(raw) {
  if (raw === undefined || raw === null) return '';
  let str = String(raw).trim();
  str = str.replace(/^@+/, '').trim();
  return str;
}

/**
 * Validates username string against AK'S MEN STYLE security and format policies
 * @param {string} username Raw username input
 * @param {number|null} currentUserId Optional ID of the requesting user to exclude from duplicate check
 * @param {object|null} db PostgreSQL DB instance for case-insensitive uniqueness check
 */
export async function validateUsername(username, currentUserId = null, db = null) {
  if (username === undefined || username === null || username === '') {
    return { valid: false, message: 'Username is required.' };
  }

  if (typeof username !== 'string') {
    return { valid: false, message: 'Username must be a string.' };
  }

  // Reject internal spaces or leading/trailing whitespace
  if (username !== username.trim() || /\s/.test(username)) {
    return { valid: false, message: 'Username cannot contain spaces.' };
  }

  const clean = normalizeUsernameInput(username);
  if (!clean) {
    return { valid: false, message: 'Username is required.' };
  }

  if (clean.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters long.' };
  }

  if (clean.length > 30) {
    return { valid: false, message: 'Username cannot exceed 30 characters.' };
  }

  // Only letters, digits, and underscores allowed
  const validRegex = /^[a-zA-Z0-9_]+$/;
  if (!validRegex.test(clean)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores.' };
  }

  if (db) {
    // Case-insensitive uniqueness check across all users
    let query = 'SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)';
    const params = [clean];
    if (currentUserId) {
      query += ' AND id != ?';
      params.push(currentUserId);
    }
    const existing = (await db.prepare(query).get(...params));
    if (existing) {
      return { valid: false, message: 'Username already exists.' };
    }
  }

  return { valid: true, cleanUsername: clean, message: 'Username available.' };
}
