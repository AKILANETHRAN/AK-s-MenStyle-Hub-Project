import db from '../config/database.js';

/**
 * GET /api/admin/metrics
 * Returns real database counts for all core entities
 */
export function getAdminMetrics(req, res) {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const totalProducts = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    const totalPurchases = db.prepare('SELECT COUNT(*) AS count FROM purchases').get().count;
    const totalWishlistItems = db.prepare('SELECT COUNT(*) AS count FROM wishlist_items').get().count;
    const totalFriendConnections = db.prepare("SELECT COUNT(*) AS count FROM friendships WHERE status = 'ACCEPTED'").get().count;
    const totalVtonResults = db.prepare('SELECT COUNT(*) AS count FROM try_on_results').get().count;
    
    let totalRecentlyAccessed = 0;
    try {
      totalRecentlyAccessed = db.prepare('SELECT COUNT(*) AS count FROM recently_accessed').get().count;
    } catch (e) {
      totalRecentlyAccessed = 0;
    }

    const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchases').get().total;

    return res.status(200).json({
      status: 'success',
      metrics: {
        totalUsers,
        totalProducts,
        totalPurchases,
        totalWishlistItems,
        totalFriendConnections,
        totalVtonResults,
        totalRecentlyAccessed,
        totalRevenue: Math.round(totalRevenue)
      }
    });
  } catch (err) {
    console.error('getAdminMetrics error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin metrics.' });
  }
}

/**
 * GET /api/admin/products
 * Returns full product catalog for admin overview
 */
export function getAdminProducts(req, res) {
  try {
    const products = db.prepare(`
      SELECT 
        id, name, brand, category, cloth_type AS clothType, color,
        price, original_price AS originalPrice, discount_percent AS discountPercent,
        stock, status, image, garment_image AS garmentImage,
        vton_supported AS vtonSupported, vton_garment_category AS vtonCategory,
        created_at AS createdAt
      FROM products
      ORDER BY id ASC
    `).all();

    return res.status(200).json({
      status: 'success',
      count: products.length,
      products
    });
  } catch (err) {
    console.error('getAdminProducts error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin products.' });
  }
}

/**
 * PATCH /api/admin/products/:id
 * Safely update product stock, price, discount without modifying image/garment identity
 */
export function updateAdminProduct(req, res) {
  try {
    const { id } = req.params;
    const { price, discountPercent, stock } = req.body;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found.' });
    }

    let newPrice = product.price;
    if (price !== undefined) {
      const p = Number(price);
      if (isNaN(p) || p < 400 || p > 700) {
        return res.status(400).json({ status: 'error', message: 'Price must be between ₹400 and ₹700.' });
      }
      newPrice = p;
    }

    let newDiscount = product.discount_percent;
    if (discountPercent !== undefined) {
      const d = Number(discountPercent);
      if (![0, 20, 30, 40].includes(d)) {
        return res.status(400).json({ status: 'error', message: 'Discount must be 0%, 20%, 30%, or 40%.' });
      }
      newDiscount = d;
    }

    let newStock = product.stock;
    if (stock !== undefined) {
      const s = parseInt(stock, 10);
      if (isNaN(s) || s < 0) {
        return res.status(400).json({ status: 'error', message: 'Stock must be a non-negative integer.' });
      }
      newStock = s;
    }

    const newStatus = newStock > 0 ? 'IN_STOCK' : 'SOLD_OUT';
    const newOriginalPrice = newDiscount === 0 ? newPrice : Math.round(newPrice / (1 - newDiscount / 100));

    db.prepare(`
      UPDATE products
      SET price = ?, original_price = ?, discount_percent = ?, stock = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPrice, newOriginalPrice, newDiscount, newStock, newStatus, id);

    const updated = db.prepare(`
      SELECT id, name, brand, category, price, original_price AS originalPrice, discount_percent AS discountPercent, stock, status, vton_supported AS vtonSupported
      FROM products
      WHERE id = ?
    `).get(id);

    return res.status(200).json({
      status: 'success',
      message: 'Product updated successfully.',
      product: updated
    });
  } catch (err) {
    console.error('updateAdminProduct error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update product.' });
  }
}

/**
 * GET /api/admin/users
 * Returns user accounts without exposing passwords or password hashes
 */
export function getAdminUsers(req, res) {
  try {
    const users = db.prepare(`
      SELECT 
        id, username, full_name AS fullName, email,
        COALESCE(role, 'USER') AS role,
        phone, city, state, created_at AS createdAt
      FROM users
      ORDER BY id DESC
    `).all();

    return res.status(200).json({
      status: 'success',
      count: users.length,
      users
    });
  } catch (err) {
    console.error('getAdminUsers error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin users.' });
  }
}

/**
 * GET /api/admin/purchases
 * Real purchases with associated owner username and items
 */
export function getAdminPurchases(req, res) {
  try {
    const purchases = db.prepare(`
      SELECT 
        p.id,
        p.user_id AS userId,
        u.username AS ownerUsername,
        u.email AS ownerEmail,
        p.purchase_type AS purchaseType,
        p.total_amount AS totalAmount,
        p.delivery_name AS deliveryName,
        p.delivery_city AS deliveryCity,
        p.delivery_state AS deliveryState,
        p.created_at AS purchaseDate
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
      LIMIT 100
    `).all();

    const getItemsStmt = db.prepare(`
      SELECT 
        pi.id,
        pi.product_id AS productId,
        pr.name AS productName,
        pr.brand AS productBrand,
        pr.category AS productCategory,
        pr.image AS productImage,
        pi.quantity,
        pi.unit_price AS unitPrice
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `);

    const result = purchases.map(purchase => {
      const items = getItemsStmt.all(purchase.id);
      return {
        ...purchase,
        items
      };
    });

    return res.status(200).json({
      status: 'success',
      count: result.length,
      purchases: result
    });
  } catch (err) {
    console.error('getAdminPurchases error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin purchases.' });
  }
}

/**
 * GET /api/admin/vton-stats
 * Real VTON usage statistics (totals, tops, bottoms, success count)
 */
export function getAdminVtonStats(req, res) {
  try {
    const totalResults = db.prepare('SELECT COUNT(*) AS count FROM try_on_results').get().count;
    const topCount = db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE category = 'tops'").get().count;
    const bottomCount = db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE category = 'bottoms'").get().count;
    const successCount = db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'COMPLETED'").get().count;
    const processingCount = db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'PROCESSING'").get().count;
    const failedCount = db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'FAILED'").get().count;

    return res.status(200).json({
      status: 'success',
      vtonStats: {
        totalResults,
        topCount,
        bottomCount,
        successCount,
        processingCount,
        failedCount
      }
    });
  } catch (err) {
    console.error('getAdminVtonStats error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve VTON statistics.' });
  }
}

/**
 * GET /api/admin/recent-activity
 * Returns aggregate recent transactions and social activity
 */
export function getAdminRecentActivity(req, res) {
  try {
    const recentPurchases = db.prepare(`
      SELECT p.id, u.username, p.total_amount, p.created_at, 'PURCHASE' as type
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
      LIMIT 5
    `).all();

    const recentShares = db.prepare(`
      SELECT ws.id, s.username as sender, r.username as receiver, ws.share_type, ws.created_at, 'SHARE' as type
      FROM wishlist_shares ws
      JOIN users s ON ws.sender_id = s.id
      JOIN users r ON ws.receiver_id = r.id
      ORDER BY ws.id DESC
      LIMIT 5
    `).all();

    const recentUsers = db.prepare(`
      SELECT id, username, full_name, email, role, created_at, 'REGISTRATION' as type
      FROM users
      ORDER BY id DESC
      LIMIT 5
    `).all();

    return res.status(200).json({
      status: 'success',
      activity: {
        recentPurchases,
        recentShares,
        recentUsers
      }
    });
  } catch (err) {
    console.error('getAdminRecentActivity error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve recent activity.' });
  }
}
