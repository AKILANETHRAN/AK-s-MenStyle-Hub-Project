import db from '../config/database.js';
import { CART_REWARD_TIERS } from '../services/cartRewardService.js';
import { getEmailConfig } from '../services/emailService.js';
import { getProductSizes } from '../utils/sizeHelper.js';
import { sendTestProductWhatsAppEvent } from '../services/communicationService.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';

/**
 * GET /api/admin/metrics
 * Returns real database counts for all core entities
 */
export async function getAdminMetrics(req, res) {
  try {
    const totalUsers = (await db.prepare('SELECT COUNT(*) AS count FROM users').get()).count;
    const totalProducts = (await db.prepare('SELECT COUNT(*) AS count FROM products').get()).count;
    const totalPurchases = (await db.prepare('SELECT COUNT(*) AS count FROM purchases').get()).count;
    const totalWishlistItems = (await db.prepare('SELECT COUNT(*) AS count FROM wishlist_items').get()).count;
    const totalFriendConnections = (await db.prepare("SELECT COUNT(*) AS count FROM friendships WHERE status = 'ACCEPTED'").get()).count;
    const totalVtonResults = (await db.prepare('SELECT COUNT(*) AS count FROM try_on_results').get()).count;

    let totalRecentlyAccessed = 0;
    try {
      totalRecentlyAccessed = (await db.prepare('SELECT COUNT(*) AS count FROM recently_accessed').get()).count;
    } catch (e) {
      totalRecentlyAccessed = 0;
    }

    const totalRevenue = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchases').get()).total;

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
      },
      cartRewardTiers: CART_REWARD_TIERS
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
export async function getAdminProducts(req, res) {
  try {
    const pagination = parsePagination(req.query, 20);
    if (pagination?.error) return res.status(400).json({ status: 'error', message: pagination.error });
    const total = pagination ? (await db.prepare('SELECT COUNT(*) AS total FROM products').get()).total : null;
    const products = (await db.prepare(`
      SELECT
        id, name, brand, category, cloth_type AS clothType, color,
        price, original_price AS originalPrice, discount_percent AS discountPercent,
        is_new_arrival AS isNewArrival,
        stock, status, image, garment_image AS garmentImage,
        vton_supported AS vtonSupported, vton_garment_category AS vtonCategory,
        created_at AS createdAt
      FROM products
      ORDER BY id ASC
      ${pagination ? 'LIMIT ? OFFSET ?' : ''}
    `).all(...(pagination ? [pagination.pageSize, pagination.offset] : [])));

    const enrichedProducts = products.map(p => ({
      ...p,
      sizes: getProductSizes(p)
    }));

    return res.status(200).json({
      status: 'success',
      count: pagination ? total : enrichedProducts.length,
      products: enrichedProducts,
      ...(pagination ? { pagination: paginationMeta(total, pagination) } : {})
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
export async function updateAdminProduct(req, res) {
  try {
    const { id } = req.params;
    const { price, discountPercent, stock, isNewArrival } = req.body;

    const product = (await db.prepare('SELECT * FROM products WHERE id = ?').get(id));
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

    let newIsNewArrival = Number(product.is_new_arrival) === 1;
    if (isNewArrival !== undefined) {
      if (typeof isNewArrival !== 'boolean') {
        return res.status(400).json({ status: 'error', message: 'New arrival must be true or false.' });
      }
      newIsNewArrival = isNewArrival;
    }

    const newStatus = newStock > 0 ? 'IN_STOCK' : 'SOLD_OUT';
    const newOriginalPrice = newDiscount === 0 ? newPrice : Math.round(newPrice / (1 - newDiscount / 100));

    (await db.prepare(`
      UPDATE products
      SET price = ?, original_price = ?, discount_percent = ?, is_new_arrival = ?, stock = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPrice, newOriginalPrice, newDiscount, newIsNewArrival ? 1 : 0, newStock, newStatus, id));

    const updated = (await db.prepare(`
      SELECT id, name, brand, category, price, original_price AS originalPrice, discount_percent AS discountPercent, is_new_arrival AS isNewArrival, stock, status, vton_supported AS vtonSupported
      FROM products
      WHERE id = ?
    `).get(id));

    const testEventPromises = [];
    if (newDiscount > 0 && newDiscount !== product.discount_percent) {
      testEventPromises.push((await sendTestProductWhatsAppEvent(updated, 'DISCOUNT_ALERT')));
    }
    if (newIsNewArrival && Number(product.is_new_arrival) !== 1) {
      testEventPromises.push((await sendTestProductWhatsAppEvent(updated, 'NEW_ARRIVAL')));
    }

    const whatsappTestEvents = await Promise.all(testEventPromises);
    return res.status(200).json({
      status: 'success',
      message: 'Product updated successfully.',
      product: updated,
      whatsappTestEvents
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
export async function getAdminUsers(req, res) {
  try {
    const pagination = parsePagination(req.query, 20);
    if (pagination?.error) return res.status(400).json({ status: 'error', message: pagination.error });
    const total = pagination ? (await db.prepare('SELECT COUNT(*) AS total FROM users').get()).total : null;
    const users = (await db.prepare(`
      SELECT
        id, username, full_name AS fullName, email,
        COALESCE(role, 'USER') AS role,
        phone, city, state, created_at AS createdAt
      FROM users
      ORDER BY id DESC
      ${pagination ? 'LIMIT ? OFFSET ?' : ''}
    `).all(...(pagination ? [pagination.pageSize, pagination.offset] : [])));

    return res.status(200).json({
      status: 'success',
      count: pagination ? total : users.length,
      users,
      ...(pagination ? { pagination: paginationMeta(total, pagination) } : {})
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
export async function getAdminPurchases(req, res) {
  try {
    const pagination = parsePagination(req.query, 10);
    if (pagination?.error) return res.status(400).json({ status: 'error', message: pagination.error });
    const total = pagination ? (await db.prepare('SELECT COUNT(*) AS total FROM purchases').get()).total : null;
    const purchases = (await db.prepare(`
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
      ${pagination ? 'LIMIT ? OFFSET ?' : 'LIMIT 100'}
    `).all(...(pagination ? [pagination.pageSize, pagination.offset] : [])));

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

    const result = (await Promise.all(purchases.map(async purchase => {
      const items = (await getItemsStmt.all(purchase.id));
      return {
        ...purchase,
        items
      };
    })));

    return res.status(200).json({
      status: 'success',
      count: pagination ? total : result.length,
      purchases: result,
      ...(pagination ? { pagination: paginationMeta(total, pagination) } : {})
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
export async function getAdminVtonStats(req, res) {
  try {
    const totalResults = (await db.prepare('SELECT COUNT(*) AS count FROM try_on_results').get()).count;
    const topCount = (await db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE category = 'tops'").get()).count;
    const bottomCount = (await db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE category = 'bottoms'").get()).count;
    const successCount = (await db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'COMPLETED'").get()).count;
    const processingCount = (await db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'PROCESSING'").get()).count;
    const failedCount = (await db.prepare("SELECT COUNT(*) AS count FROM try_on_results WHERE status = 'FAILED'").get()).count;

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
export async function getAdminRecentActivity(req, res) {
  try {
    const recentPurchases = (await db.prepare(`
      SELECT p.id, u.username, p.total_amount, p.created_at, 'PURCHASE' as type
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
      LIMIT 5
    `).all());

    const recentShares = (await db.prepare(`
      SELECT ws.id, s.username as sender, r.username as receiver, ws.share_type, ws.created_at, 'SHARE' as type
      FROM wishlist_shares ws
      JOIN users s ON ws.sender_id = s.id
      JOIN users r ON ws.receiver_id = r.id
      ORDER BY ws.id DESC
      LIMIT 5
    `).all());

    const recentUsers = (await db.prepare(`
      SELECT id, username, full_name, email, role, created_at, 'REGISTRATION' as type
      FROM users
      ORDER BY id DESC
      LIMIT 5
    `).all());

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

/**
 * GET /api/admin/email/status
 * Returns email delivery status safely without exposing credentials
 */
export function getAdminEmailStatus(req, res) {
  try {
    const config = getEmailConfig();
    return res.status(200).json({
      enabled: config.isEnabled,
      configured: config.isConfigured,
      provider: 'SMTP',
      sender: config.from,
      hostConfigured: Boolean(config.host),
      port: config.port
    });
  } catch (err) {
    console.error('getAdminEmailStatus error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve email status.' });
  }
}
