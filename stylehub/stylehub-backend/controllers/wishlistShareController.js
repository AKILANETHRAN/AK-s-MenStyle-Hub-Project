import db from '../config/database.js';

/**
 * Helper to verify that two users are currently accepted friends
 */
function areAcceptedFriends(userA, userB) {
  const row = db.prepare(`
    SELECT id FROM friendships
    WHERE status = 'ACCEPTED'
      AND ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?))
  `).get(userA, userB, userB, userA);
  return !!row;
}

/**
 * POST /api/wishlist/shares
 * Body: { receiverId: number, productIds: number[] }
 */
export function createWishlistShare(req, res, next) {
  try {
    const senderId = req.userId;
    const { receiverId, productIds, shareType } = req.body;

    const parsedReceiverId = parseInt(receiverId, 10);
    if (isNaN(parsedReceiverId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid receiverId is required.'
      });
    }

    // 1. Resolve receiver: handles case where either userId or friendshipId was passed
    let effectiveReceiverId = parsedReceiverId;
    let receiver = db.prepare('SELECT id, username FROM users WHERE id = ?').get(effectiveReceiverId);
    if (!receiver) {
      const friendship = db.prepare('SELECT requester_id, receiver_id FROM friendships WHERE id = ? AND status = "ACCEPTED"').get(parsedReceiverId);
      if (friendship) {
        effectiveReceiverId = friendship.requester_id === senderId ? friendship.receiver_id : friendship.requester_id;
        receiver = db.prepare('SELECT id, username FROM users WHERE id = ?').get(effectiveReceiverId);
      }
    }

    if (!receiver) {
      return res.status(404).json({
        status: 'error',
        message: 'Recipient user not found.'
      });
    }

    if (senderId === effectiveReceiverId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot share with yourself.'
      });
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one product must be selected to share.'
      });
    }

    // 2. Strict Privacy Check: Sender and receiver must be ACCEPTED friends
    if (!areAcceptedFriends(senderId, effectiveReceiverId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Private sharing is restricted to accepted friends only.'
      });
    }

    // 3. Sender's wishlist must exist
    let senderWishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(senderId);
    if (!senderWishlist) {
      db.prepare('INSERT INTO wishlists (user_id) VALUES (?)').run(senderId);
      senderWishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(senderId);
    }

    // 4. Verify all productIds belong to catalog products
    const placeholders = productIds.map(() => '?').join(',');
    const validCatalogProducts = db.prepare(`
      SELECT id FROM products WHERE id IN (${placeholders})
    `).all(...productIds.map(Number)).map(r => r.id);

    if (validCatalogProducts.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid products selected to share.'
      });
    }

    // Preserve the exact order of productIds
    const sanitizedProductIds = [];
    for (const pid of productIds) {
      const numId = Number(pid);
      if (validCatalogProducts.includes(numId) && !sanitizedProductIds.includes(numId)) {
        sanitizedProductIds.push(numId);
      }
    }

    // If type is PRODUCTS, also ensure sender has them in wishlist
    const type = (shareType === 'LOOK' || shareType === 'LOOKS') ? 'LOOK' : 'PRODUCTS';
    if (type === 'PRODUCTS') {
      const insertWishlistItem = db.prepare('INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)');
      for (const pId of sanitizedProductIds) {
        insertWishlistItem.run(senderWishlist.id, pId);
      }
    }

    // 5. Create fresh wishlist_shares entry with share_type
    const shareResult = db.prepare(`
      INSERT INTO wishlist_shares (sender_id, receiver_id, wishlist_id, share_type, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(senderId, effectiveReceiverId, senderWishlist.id, type);
    const shareId = shareResult.lastInsertRowid;

    // 6. Save items in wishlist_share_items in exact order
    const insertItem = db.prepare('INSERT OR IGNORE INTO wishlist_share_items (share_id, product_id) VALUES (?, ?)');
    for (const pId of sanitizedProductIds) {
      insertItem.run(shareId, pId);
    }

    // 7. Notification for receiver with related_id
    const sender = db.prepare('SELECT username FROM users WHERE id = ?').get(senderId);
    const notifTitle = type === 'LOOK' ? 'Complete Look Shared' : 'Curated Products Shared';
    const notifMsg = type === 'LOOK'
      ? `@${sender.username} shared a complete outfit look with you.`
      : `@${sender.username} shared ${sanitizedProductIds.length} curated product(s) with you.`;

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'WISHLIST_SHARED', ?, ?, ?)
    `).run(effectiveReceiverId, notifTitle, notifMsg, shareId);

    return res.status(201).json({
      status: 'success',
      message: type === 'LOOK' ? `Complete look shared with @${receiver.username}!` : `Curated products shared with @${receiver.username}!`,
      data: {
        shareId,
        shareType: type,
        receiver: { id: receiver.id, username: receiver.username },
        sharedItemCount: sanitizedProductIds.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wishlist/shares
 * Returns all shared looks for the authenticated user
 */
export function getWishlistShares(req, res, next) {
  try {
    const userId = req.userId;

    const sharedWithMe = db.prepare(`
      SELECT
        ws.id AS shareId,
        ws.sender_id AS senderId,
        ws.share_type AS shareType,
        u.username AS senderUsername,
        u.full_name AS senderFullName,
        ws.created_at AS createdAt,
        COUNT(DISTINCT wsi.product_id) AS itemCount,
        COUNT(DISTINCT wf.id) AS feedbackCount
      FROM wishlist_shares ws
      JOIN users u ON u.id = ws.sender_id
      LEFT JOIN wishlist_share_items wsi ON wsi.share_id = ws.id
      LEFT JOIN wishlist_feedback wf ON wf.share_id = ws.id
      WHERE ws.receiver_id = ?
      GROUP BY ws.id
      ORDER BY ws.created_at DESC
    `).all(userId);

    const sharedByMe = db.prepare(`
      SELECT
        ws.id AS shareId,
        ws.receiver_id AS receiverId,
        ws.share_type AS shareType,
        u.username AS receiverUsername,
        u.full_name AS receiverFullName,
        ws.created_at AS createdAt,
        COUNT(DISTINCT wsi.product_id) AS itemCount,
        COUNT(DISTINCT wf.id) AS feedbackCount
      FROM wishlist_shares ws
      JOIN users u ON u.id = ws.receiver_id
      LEFT JOIN wishlist_share_items wsi ON wsi.share_id = ws.id
      LEFT JOIN wishlist_feedback wf ON wf.share_id = ws.id
      WHERE ws.sender_id = ?
      GROUP BY ws.id
      ORDER BY ws.created_at DESC
    `).all(userId);

    return res.status(200).json({
      status: 'success',
      data: {
        sharedWithMe,
        sharedByMe
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wishlist/shares/:shareId
 * Fetch single shared look. Access strictly limited to sender & intended receiver.
 */
export function getWishlistShareById(req, res, next) {
  try {
    const userId = req.userId;
    const shareId = parseInt(req.params.shareId, 10);

    const share = db.prepare(`
      SELECT
        ws.id AS shareId,
        ws.sender_id AS senderId,
        ws.receiver_id AS receiverId,
        ws.wishlist_id AS wishlistId,
        ws.share_type AS shareType,
        ws.created_at AS createdAt,
        s.username AS senderUsername,
        s.full_name AS senderFullName,
        r.username AS receiverUsername,
        r.full_name AS receiverFullName
      FROM wishlist_shares ws
      JOIN users s ON s.id = ws.sender_id
      JOIN users r ON r.id = ws.receiver_id
      WHERE ws.id = ?
    `).get(shareId);

    if (!share) {
      return res.status(404).json({
        status: 'error',
        message: 'Shared look not found.'
      });
    }

    // Access Control: ONLY sender or receiver can view
    if (share.senderId !== userId && share.receiverId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to private shared look.'
      });
    }

    // Friendship Verification: Must still be accepted friends
    if (!areAcceptedFriends(share.senderId, share.receiverId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Private share is no longer accessible because friendship was removed.'
      });
    }

    // Fetch shared products preserving exact shared order
    const products = db.prepare(`
      SELECT
        p.id AS productId,
        p.name,
        p.brand,
        p.category,
        p.cloth_type AS clothType,
        p.color,
        p.image,
        p.price,
        p.original_price AS originalPrice,
        p.discount_percent AS discountPercent,
        p.stock,
        p.status
      FROM wishlist_share_items wsi
      JOIN products p ON p.id = wsi.product_id
      WHERE wsi.share_id = ?
      ORDER BY wsi.id ASC
    `).all(shareId);

    // Fetch feedback
    const feedback = db.prepare(`
      SELECT
        wf.id,
        wf.user_id AS userId,
        u.username,
        u.full_name AS fullName,
        wf.reaction,
        wf.comment,
        wf.created_at AS createdAt
      FROM wishlist_feedback wf
      JOIN users u ON u.id = wf.user_id
      WHERE wf.share_id = ?
      ORDER BY wf.created_at ASC
    `).all(shareId);

    return res.status(200).json({
      status: 'success',
      data: {
        shareId: share.shareId,
        id: share.shareId,
        senderId: share.senderId,
        receiverId: share.receiverId,
        share: {
          id: share.shareId,
          shareId: share.shareId,
          senderId: share.senderId,
          receiverId: share.receiverId,
          shareType: share.shareType || 'PRODUCTS',
          createdAt: share.createdAt
        },
        shareType: share.shareType || 'PRODUCTS',
        createdAt: share.createdAt,
        isSender: share.senderId === userId,
        isReceiver: share.receiverId === userId,
        sender: {
          id: share.senderId,
          username: share.senderUsername,
          fullName: share.senderFullName
        },
        receiver: {
          id: share.receiverId,
          username: share.receiverUsername,
          fullName: share.receiverFullName
        },
        products: products.map(p => ({
          ...p,
          id: p.productId,
          productId: p.productId,
          isSoldOut: p.stock === 0 || p.status === 'SOLD_OUT'
        })),
        items: products.map(p => ({
          ...p,
          id: p.productId,
          productId: p.productId,
          isSoldOut: p.stock === 0 || p.status === 'SOLD_OUT'
        })),
        feedback
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wishlist/shares/:shareId/feedback
 * Receiver submits reaction (LIKE, LOVE, FIRE) and/or style comment
 */
export function addShareFeedback(req, res, next) {
  try {
    const userId = req.userId;
    const shareId = parseInt(req.params.shareId, 10);
    const { reaction, comment } = req.body;

    if (!shareId || isNaN(shareId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid share ID.'
      });
    }

    const share = db.prepare(`
      SELECT ws.id, ws.sender_id, ws.receiver_id
      FROM wishlist_shares ws
      WHERE ws.id = ?
    `).get(shareId);

    if (!share) {
      return res.status(404).json({
        status: 'error',
        message: 'Shared look not found.'
      });
    }

    // Access control: ONLY the intended receiver may submit reaction or feedback
    if (share.receiver_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only the recipient can react or provide feedback.'
      });
    }

    // Friendship Verification: Must still be active accepted friends
    if (!areAcceptedFriends(share.sender_id, share.receiver_id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only comment on shares with active friends.'
      });
    }

    const validReactions = ['LIKE', 'LOVE', 'FIRE'];
    if (reaction !== undefined && reaction !== null && !validReactions.includes(reaction)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reaction. Must be LIKE, LOVE, or FIRE.'
      });
    }

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid comment format.'
        });
      }
      if (comment.length > 500) {
        return res.status(400).json({
          status: 'error',
          message: 'Feedback must be 500 characters or less.'
        });
      }
    }

    const hasValidReaction = Boolean(reaction && validReactions.includes(reaction));
    const hasComment = typeof comment === 'string';
    const trimmedComment = hasComment ? comment.trim() : '';

    if (!hasValidReaction && (!hasComment || trimmedComment.length === 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a reaction or non-empty feedback.'
      });
    }

    // Fetch existing feedback for this receiver and share
    const existingRows = db.prepare(`
      SELECT id, reaction, comment
      FROM wishlist_feedback
      WHERE share_id = ? AND user_id = ?
      ORDER BY id ASC
    `).all(shareId, userId);

    const existingFeedback = existingRows[0] || null;

    // Prune any legacy duplicate rows if they existed from previous buggy runs
    if (existingRows.length > 1) {
      for (let i = 1; i < existingRows.length; i++) {
        db.prepare('DELETE FROM wishlist_feedback WHERE id = ?').run(existingRows[i].id);
      }
    }

    const targetReaction = hasValidReaction ? reaction : (existingFeedback ? existingFeedback.reaction : null);
    let targetComment;
    if (hasComment) {
      targetComment = trimmedComment.length > 0 ? trimmedComment : null;
    } else {
      targetComment = existingFeedback ? existingFeedback.comment : null;
    }

    let feedbackId;
    let isNew = false;
    if (existingFeedback) {
      db.prepare(`
        UPDATE wishlist_feedback
        SET reaction = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(targetReaction, targetComment, existingFeedback.id);
      feedbackId = existingFeedback.id;
    } else {
      const insertResult = db.prepare(`
        INSERT INTO wishlist_feedback (share_id, user_id, reaction, comment)
        VALUES (?, ?, ?, ?)
      `).run(shareId, userId, targetReaction, targetComment);
      feedbackId = insertResult.lastInsertRowid;
      isNew = true;
    }

    const currentUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    const username = currentUser ? currentUser.username : 'Friend';
    const reactionEmoji = targetReaction === 'LOVE' ? '❤️' : targetReaction === 'FIRE' ? '🔥' : '👍';

    let notifMsg;
    let notifTitle;
    if (hasComment && trimmedComment.length > 0 && hasValidReaction) {
      notifTitle = 'Feedback on Shared Look';
      notifMsg = `@${username} reacted ${reactionEmoji} and commented on your look.`;
    } else if (hasValidReaction) {
      notifTitle = 'Reaction on Shared Look';
      notifMsg = `@${username} reacted ${reactionEmoji} to your shared look.`;
    } else {
      notifTitle = 'Feedback on Shared Look';
      notifMsg = `@${username} left feedback on your shared look.`;
    }

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'WISHLIST_FEEDBACK', ?, ?, ?)
    `).run(share.sender_id, notifTitle, notifMsg, shareId);

    const updatedFeedback = db.prepare(`
      SELECT
        wf.id,
        wf.user_id AS userId,
        u.username,
        u.full_name AS fullName,
        wf.reaction,
        wf.comment,
        wf.created_at AS createdAt,
        wf.updated_at AS updatedAt
      FROM wishlist_feedback wf
      JOIN users u ON u.id = wf.user_id
      WHERE wf.share_id = ?
      ORDER BY wf.created_at ASC
    `).all(shareId);

    return res.status(201).json({
      status: 'success',
      message: isNew ? 'Feedback posted successfully.' : 'Feedback updated successfully.',
      data: {
        feedbackId,
        shareId,
        reaction: targetReaction,
        comment: targetComment,
        feedback: updatedFeedback
      }
    });
  } catch (err) {
    next(err);
  }
}
