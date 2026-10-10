import db from '../config/database.js';

/**
 * GET /api/recently-accessed
 * Returns the authenticated user's recently viewed products (latest first, limit 12)
 * Strictly isolated to req.userId
 */
export function getRecentlyAccessed(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Authentication required.' });
    }

    const products = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.category,
        p.cloth_type AS clothType,
        p.color,
        p.price,
        p.original_price AS originalPrice,
        p.discount_percent AS discountPercent,
        p.stock,
        p.status,
        p.image,
        p.vton_supported AS vtonSupported,
        ra.accessed_at AS accessedAt
      FROM recently_accessed ra
      JOIN products p ON ra.product_id = p.id
      WHERE ra.user_id = ?
      ORDER BY ra.accessed_at DESC
      LIMIT 12
    `).all(userId);

    return res.status(200).json({
      status: 'success',
      count: products.length,
      products
    });
  } catch (err) {
    console.error('getRecentlyAccessed error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve recently accessed products.' });
  }
}

/**
 * POST /api/recently-accessed
 * Records a viewed product for the authenticated user with upsert behavior
 * Body: { productId }
 */
export function recordRecentlyAccessed(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Authentication required.' });
    }

    const productId = parseInt(req.body.productId || req.params.productId, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid productId is required.' });
    }

    // Verify product exists in catalog
    const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product does not exist in catalog.' });
    }

    const nowIso = new Date().toISOString();
    // Safe upsert updating accessed_at to current ISO timestamp
    db.prepare(`
      INSERT INTO recently_accessed (user_id, product_id, accessed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, product_id)
      DO UPDATE SET accessed_at = excluded.accessed_at
    `).run(userId, productId, nowIso);

    return res.status(200).json({
      status: 'success',
      message: 'Product access recorded.',
      productId
    });
  } catch (err) {
    console.error('recordRecentlyAccessed error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to record recently accessed product.' });
  }
}
