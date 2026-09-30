import db from '../config/database.js';

/**
 * GET /api/friends
 * Returns all accepted friends of the authenticated user
 */
export function getFriends(req, res, next) {
  try {
    const userId = req.userId;

    const rows = db.prepare(`
      SELECT
        f.id AS friendshipId,
        CASE WHEN f.requester_id = ? THEN f.receiver_id ELSE f.requester_id END AS userId,
        u.username,
        u.full_name AS fullName,
        f.created_at AS createdAt
      FROM friendships f
      JOIN users u ON u.id = (CASE WHEN f.requester_id = ? THEN f.receiver_id ELSE f.requester_id END)
      WHERE (f.requester_id = ? OR f.receiver_id = ?) AND f.status = 'ACCEPTED'
      ORDER BY u.username ASC
    `).all(userId, userId, userId, userId);

    return res.status(200).json({
      status: 'success',
      data: {
        friends: rows,
        totalFriends: rows.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends/search?username=...
 * Search users by username (public profiles only)
 */
export function searchUsers(req, res, next) {
  try {
    const userId = req.userId;
    const { username = '' } = req.query;
    const cleanQuery = username.trim().replace(/^@/, '');

    if (!cleanQuery) {
      return res.status(200).json({
        status: 'success',
        data: { users: [] }
      });
    }

    const matches = db.prepare(`
      SELECT
        u.id,
        u.username,
        u.full_name AS fullName,
        f.id AS friendshipId,
        f.status AS friendshipStatus,
        f.requester_id AS requesterId
      FROM users u
      LEFT JOIN friendships f ON (
        (f.requester_id = ? AND f.receiver_id = u.id) OR
        (f.receiver_id = ? AND f.requester_id = u.id)
      )
      WHERE u.id != ? AND u.username LIKE ? COLLATE NOCASE
      LIMIT 20
    `).all(userId, userId, userId, `%${cleanQuery}%`);

    const users = matches.map((m) => {
      let relationship = 'NONE';
      if (m.friendshipStatus === 'ACCEPTED') {
        relationship = 'ACCEPTED';
      } else if (m.friendshipStatus === 'PENDING') {
        relationship = m.requesterId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
      } else if (m.friendshipStatus === 'REJECTED') {
        relationship = 'REJECTED';
      }

      return {
        id: m.id,
        username: m.username,
        fullName: m.fullName,
        relationship,
        friendshipId: m.friendshipId || null
      };
    });

    return res.status(200).json({
      status: 'success',
      data: { users }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends/requests
 * Returns incoming and outgoing pending friend requests
 */
export function getFriendRequests(req, res, next) {
  try {
    const userId = req.userId;

    const incoming = db.prepare(`
      SELECT
        f.id AS friendshipId,
        u.id AS userId,
        u.username,
        u.full_name AS fullName,
        f.created_at AS createdAt
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.receiver_id = ? AND f.status = 'PENDING'
      ORDER BY f.created_at DESC
    `).all(userId);

    const outgoing = db.prepare(`
      SELECT
        f.id AS friendshipId,
        u.id AS userId,
        u.username,
        u.full_name AS fullName,
        f.created_at AS createdAt
      FROM friendships f
      JOIN users u ON u.id = f.receiver_id
      WHERE f.requester_id = ? AND f.status = 'PENDING'
      ORDER BY f.created_at DESC
    `).all(userId);

    return res.status(200).json({
      status: 'success',
      data: {
        incoming,
        outgoing,
        totalIncoming: incoming.length,
        totalOutgoing: outgoing.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/request
 * Body: { receiverId?: number, username?: string }
 */
export function sendFriendRequest(req, res, next) {
  try {
    const userId = req.userId;
    let { receiverId, username } = req.body;

    let targetUser = null;
    if (receiverId) {
      targetUser = db.prepare('SELECT id, username, full_name AS fullName FROM users WHERE id = ?').get(receiverId);
    } else if (username) {
      const cleanName = username.trim().replace(/^@/, '');
      targetUser = db.prepare('SELECT id, username, full_name AS fullName FROM users WHERE username = ? COLLATE NOCASE').get(cleanName);
    }

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Target user not found.'
      });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot send a friend request to yourself.'
      });
    }

    const targetId = targetUser.id;

    // Check existing relationship
    const existing = db.prepare(`
      SELECT id, requester_id, receiver_id, status
      FROM friendships
      WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)
    `).get(userId, targetId, targetId, userId);

    const currentUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return res.status(400).json({
          status: 'error',
          message: 'You are already friends with this user.'
        });
      }

      if (existing.status === 'PENDING') {
        if (existing.requester_id === userId) {
          return res.status(400).json({
            status: 'error',
            message: 'Friend request already sent.'
          });
        } else {
          // Target user already sent a pending request to current user -> Automatically accept
          db.prepare(`
            UPDATE friendships
            SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(existing.id);

          // Notification to the other user
          db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, related_id)
            VALUES (?, 'FRIEND_ACCEPTED', 'Friend Request Accepted', ?, ?)
          `).run(targetId, `@${currentUser.username} accepted your friend request.`, existing.id);

          return res.status(200).json({
            status: 'success',
            message: `You are now friends with @${targetUser.username}!`,
            data: { friendshipId: existing.id, status: 'ACCEPTED' }
          });
        }
      }

      // If REJECTED -> Reset to PENDING
      db.prepare(`
        UPDATE friendships
        SET requester_id = ?, receiver_id = ?, status = 'PENDING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(userId, targetId, existing.id);

      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_id)
        VALUES (?, 'FRIEND_REQUEST', 'New Friend Request', ?, ?)
      `).run(targetId, `@${currentUser.username} sent you a friend request.`, existing.id);

      return res.status(200).json({
        status: 'success',
        message: `Friend request sent to @${targetUser.username}.`,
        data: { friendshipId: existing.id, status: 'PENDING' }
      });
    }

    // New Request
    const result = db.prepare(`
      INSERT INTO friendships (requester_id, receiver_id, status)
      VALUES (?, ?, 'PENDING')
    `).run(userId, targetId);

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'FRIEND_REQUEST', 'New Friend Request', ?, ?)
    `).run(targetId, `@${currentUser.username} sent you a friend request.`, result.lastInsertRowid);

    return res.status(201).json({
      status: 'success',
      message: `Friend request sent to @${targetUser.username}.`,
      data: { friendshipId: result.lastInsertRowid, status: 'PENDING' }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/:id/accept
 */
export function acceptFriendRequest(req, res, next) {
  try {
    const userId = req.userId;
    const friendshipId = parseInt(req.params.id, 10);

    const friendship = db.prepare(`
      SELECT f.id, f.requester_id, f.receiver_id, f.status, u.username AS requesterName
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.id = ?
    `).get(friendshipId);

    if (!friendship) {
      return res.status(404).json({
        status: 'error',
        message: 'Friend request not found.'
      });
    }

    if (friendship.receiver_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to accept this friend request.'
      });
    }

    if (friendship.status === 'ACCEPTED') {
      return res.status(400).json({
        status: 'error',
        message: 'This friendship is already accepted.'
      });
    }

    db.prepare(`
      UPDATE friendships
      SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(friendshipId);

    const currentUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

    // Notify requester
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'FRIEND_ACCEPTED', 'Friend Request Accepted', ?, ?)
    `).run(friendship.requester_id, `@${currentUser.username} accepted your friend request.`, friendshipId);

    return res.status(200).json({
      status: 'success',
      message: `You and @${friendship.requesterName} are now friends!`,
      data: { friendshipId, status: 'ACCEPTED' }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/:id/reject
 */
export function rejectFriendRequest(req, res, next) {
  try {
    const userId = req.userId;
    const friendshipId = parseInt(req.params.id, 10);

    const friendship = db.prepare('SELECT id, receiver_id FROM friendships WHERE id = ?').get(friendshipId);
    if (!friendship) {
      return res.status(404).json({
        status: 'error',
        message: 'Friend request not found.'
      });
    }

    if (friendship.receiver_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to reject this friend request.'
      });
    }

    db.prepare(`
      UPDATE friendships
      SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(friendshipId);

    return res.status(200).json({
      status: 'success',
      message: 'Friend request rejected.',
      data: { friendshipId, status: 'REJECTED' }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/friends/:id
 */
export function removeFriend(req, res, next) {
  try {
    const userId = req.userId;
    const friendshipId = parseInt(req.params.id, 10);

    const friendship = db.prepare(`
      SELECT id, requester_id, receiver_id
      FROM friendships
      WHERE id = ? AND (requester_id = ? OR receiver_id = ?)
    `).get(friendshipId, userId, userId);

    if (!friendship) {
      return res.status(404).json({
        status: 'error',
        message: 'Friendship not found or unauthorized.'
      });
    }

    db.prepare('DELETE FROM friendships WHERE id = ?').run(friendshipId);

    return res.status(200).json({
      status: 'success',
      message: 'Friend removed successfully.'
    });
  } catch (err) {
    next(err);
  }
}
