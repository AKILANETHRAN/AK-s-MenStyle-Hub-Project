import db from '../config/database.js';

/**
 * Helper to retrieve or create the active wishlist ID for a user
 */
function getOrCreateUserWishlist(userId) {
  let wishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(userId);
  if (!wishlist) {
    db.prepare('INSERT OR IGNORE INTO wishlists (user_id) VALUES (?)').run(userId);
    wishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(userId);
  }
  return wishlist.id;
}

/**
 * Helper to fetch and format the complete wishlist payload
 */
function getFormattedWishlist(userId) {
  const wishlistId = getOrCreateUserWishlist(userId);

  const items = db.prepare(`
    SELECT
      wi.id AS wishlistItemId,
      wi.product_id AS productId,
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
    FROM wishlist_items wi
    JOIN products p ON wi.product_id = p.id
    WHERE wi.wishlist_id = ?
    ORDER BY wi.created_at DESC
  `).all(wishlistId);

  const formattedItems = items.map((item) => ({
    wishlistItemId: item.wishlistItemId,
    productId: item.productId,
    name: item.name,
    brand: item.brand,
    category: item.category,
    clothType: item.clothType,
    color: item.color,
    image: item.image, // Strictly normal display photo
    price: item.price,
    originalPrice: item.originalPrice,
    discountPercent: item.discountPercent,
    stock: item.stock,
    isSoldOut: item.stock === 0 || item.status === 'SOLD_OUT'
  }));

  return {
    items: formattedItems,
    totalItems: formattedItems.length
  };
}

/**
 * GET /api/wishlist
 */
export function getWishlist(req, res, next) {
  try {
    const wishlist = getFormattedWishlist(req.userId);
    return res.status(200).json({
      status: 'success',
      data: wishlist
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wishlist/items
 * Body: { productId: number, action?: 'toggle' | 'add' }
 */
export function addToWishlist(req, res, next) {
  try {
    const { productId, action = 'toggle' } = req.body;
    const parsedProductId = parseInt(productId, 10);

    if (isNaN(parsedProductId) || parsedProductId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid productId is required.'
      });
    }

    const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(parsedProductId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found.'
      });
    }

    const wishlistId = getOrCreateUserWishlist(req.userId);
    const existing = db.prepare('SELECT id FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?').get(wishlistId, parsedProductId);

    let inWishlist = false;

    if (existing) {
      if (action === 'toggle') {
        db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?').run(wishlistId, parsedProductId);
        inWishlist = false;
      } else {
        // idempotent add: already in wishlist
        inWishlist = true;
      }
    } else {
      db.prepare('INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)').run(wishlistId, parsedProductId);
      inWishlist = true;
    }

    const updatedWishlist = getFormattedWishlist(req.userId);
    return res.status(200).json({
      status: 'success',
      message: inWishlist ? `Saved "${product.name}" to wishlist.` : `Removed "${product.name}" from wishlist.`,
      data: {
        ...updatedWishlist,
        inWishlist
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/wishlist/items/:productId
 */
export function removeWishlistItem(req, res, next) {
  try {
    const { productId } = req.params;
    const parsedProductId = parseInt(productId, 10);

    if (isNaN(parsedProductId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid productId is required.'
      });
    }

    const wishlistId = getOrCreateUserWishlist(req.userId);
    db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?').run(wishlistId, parsedProductId);

    const updatedWishlist = getFormattedWishlist(req.userId);
    return res.status(200).json({
      status: 'success',
      message: 'Item removed from wishlist.',
      data: updatedWishlist
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/wishlist
 */
export function clearWishlist(req, res, next) {
  try {
    const wishlistId = getOrCreateUserWishlist(req.userId);
    db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ?').run(wishlistId);

    const updatedWishlist = getFormattedWishlist(req.userId);
    return res.status(200).json({
      status: 'success',
      message: 'Wishlist cleared successfully.',
      data: updatedWishlist
    });
  } catch (err) {
    next(err);
  }
}
