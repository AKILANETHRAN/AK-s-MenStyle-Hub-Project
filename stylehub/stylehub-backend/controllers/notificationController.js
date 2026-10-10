import db from '../config/database.js';

/**
 * GET /api/notifications
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.userId;

    const notifications = (await db.prepare(`
      SELECT id, type, title, message, related_id AS relatedId, is_read AS isRead, created_at AS createdAt
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId));

    const unreadCount = (await db.prepare(`
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId)).count;

    return res.status(200).json({
      status: 'success',
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/:id/read
 */
export async function markAsRead(req, res, next) {
  try {
    const userId = req.userId;
    const notifId = parseInt(req.params.id, 10);

    (await db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).run(notifId, userId));

    return res.status(200).json({
      status: 'success',
      message: 'Notification marked as read.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/read-all
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.userId;

    (await db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
    `).run(userId));

    return res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    next(err);
  }
}
