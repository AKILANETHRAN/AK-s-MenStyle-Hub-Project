import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { getJwtSecret } from '../config/jwt.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Missing or invalid Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token payload.'
      });
    }

    const user = db.prepare(`
      SELECT id, username, full_name AS fullName, email, COALESCE(role, 'USER') AS role, phone, age, address, city, state, pincode, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authenticated user no longer exists.'
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token.'
    });
  }
}

/**
 * Admin authorization middleware (Phase 10)
 * Validates token, attaches user, and strictly queries database for ADMIN role.
 */
export function requireAdmin(req, res, next) {
  authMiddleware(req, res, () => {
    try {
      const user = db.prepare("SELECT COALESCE(role, 'USER') AS role FROM users WHERE id = ?").get(req.userId);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Administrator privileges required.'
        });
      }
      next();
    } catch (err) {
      console.error('requireAdmin check error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Authorization check failed due to server error.'
      });
    }
  });
}
