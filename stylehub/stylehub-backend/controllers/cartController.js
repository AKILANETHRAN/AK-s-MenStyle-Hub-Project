import db from '../config/database.js';
import { calculateCartReward } from '../services/cartRewardService.js';
import { validateProductSize } from '../utils/sizeHelper.js';

/**
 * Helper to retrieve or create the active cart ID for a user
 */
function getOrCreateUserCart(userId) {
  let cart = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(userId);
  if (!cart) {
    db.prepare('INSERT OR IGNORE INTO cart (user_id) VALUES (?)').run(userId);
    cart = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(userId);
  }
  return cart.id;
}

/**
 * Helper to fetch and format the complete cart payload
 */
function getFormattedCart(userId) {
  const cartId = getOrCreateUserCart(userId);

  const items = db.prepare(`
    SELECT
      ci.id AS cartItemId,
      ci.product_id AS productId,
      ci.size,
      ci.quantity,
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
      p.status,
      p.vton_garment_category AS vtonCategory
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ?
    ORDER BY ci.created_at ASC
  `).all(cartId);

  let totalItems = 0;
  let subtotal = 0;

  const formattedItems = items.map((item) => {
    const isOutOfStock = item.stock === 0 || item.status === 'SOLD_OUT';
    const insufficientStock = item.quantity > item.stock;
    const lineTotal = Math.round(item.price * item.quantity * 100) / 100;

    totalItems += item.quantity;
    subtotal += lineTotal;

    return {
      cartItemId: item.cartItemId,
      productId: item.productId,
      size: item.size || null,
      name: item.name,
      brand: item.brand,
      category: item.category,
      clothType: item.clothType,
      color: item.color,
      image: item.image, // Strictly normal display photo
      price: item.price,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      quantity: item.quantity,
      stock: item.stock,
      lineTotal,
      isOutOfStock,
      insufficientStock,
      stockWarning: insufficientStock
        ? `Only ${item.stock} available now.`
        : isOutOfStock
        ? 'Out of stock.'
        : null
    };
  });

  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const cartReward = calculateCartReward(roundedSubtotal);

  return {
    items: formattedItems,
    totalItems,
    subtotal: roundedSubtotal,
    cartReward
  };
}

/**
 * GET /api/cart
 */
export function getCart(req, res, next) {
  try {
    const cart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      data: cart
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/cart/items
 * Body: { productId: number, quantity?: number, size?: string }
 */
export function addToCart(req, res, next) {
  try {
    const { productId, quantity = 1, size } = req.body || {};
    const parsedProductId = parseInt(productId, 10);
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedProductId) || parsedProductId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid productId is required.'
      });
    }

    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Quantity must be at least 1.'
      });
    }

    // 1. Verify product exists
    const product = db.prepare('SELECT id, name, stock, status, price, category, cloth_type, vton_garment_category FROM products WHERE id = ?').get(parsedProductId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found.'
      });
    }

    // 2. Validate Size for Clothing vs Accessories
    const sizeValidation = validateProductSize(product, size);
    if (!sizeValidation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: sizeValidation.error
      });
    }
    const validatedSize = sizeValidation.size;

    // 3. Stock check: Stock = 0 -> reject "Out of stock."
    if (product.stock === 0 || product.status === 'SOLD_OUT') {
      return res.status(400).json({
        status: 'error',
        message: 'Out of stock.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);

    // 4. Check existing item variant in cart
    let existing;
    if (validatedSize) {
      existing = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?').get(cartId, parsedProductId, validatedSize);
    } else {
      existing = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size IS NULL').get(cartId, parsedProductId);
    }

    const existingQty = existing ? existing.quantity : 0;
    const targetQty = existingQty + parsedQuantity;

    // Validate quantity against product stock across all variants of this product in cart
    const otherVariantsQty = db.prepare(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_items WHERE cart_id = ? AND product_id = ? AND id != ?'
    ).get(cartId, parsedProductId, existing ? existing.id : 0).total;

    if ((otherVariantsQty + targetQty) > product.stock) {
      return res.status(400).json({
        status: 'error',
        message: `Only ${product.stock} items are available.`
      });
    }

    // 5. Insert or update atomically
    if (existing) {
      db.prepare(`
        UPDATE cart_items
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(targetQty, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart_items (cart_id, product_id, size, quantity, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(cartId, parsedProductId, validatedSize, targetQty);
    }

    const updatedCart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      message: `Added "${product.name}"${validatedSize ? ` (${validatedSize})` : ''} to cart.`,
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/cart/items/:idOrProductId
 * Body: { quantity: number, size?: string }
 */
export function updateCartItemQuantity(req, res, next) {
  try {
    const rawId = req.params.productId;
    const parsedId = parseInt(rawId, 10);
    const { quantity, size } = req.body || {};
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid identifier is required.'
      });
    }

    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Quantity must be at least 1.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);

    // 1. Find cart item: first try matching cart_items.id directly
    let item = db.prepare('SELECT id, product_id, size, quantity FROM cart_items WHERE id = ? AND cart_id = ?').get(parsedId, cartId);

    // 2. If not found by primary key, try matching by product_id (+ optional size)
    if (!item) {
      const requestedSize = (size || req.query?.size || '').toString().trim().toUpperCase() || null;
      if (requestedSize) {
        item = db.prepare('SELECT id, product_id, size, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?').get(cartId, parsedId, requestedSize);
      } else {
        item = db.prepare('SELECT id, product_id, size, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size IS NULL').get(cartId, parsedId)
            || db.prepare('SELECT id, product_id, size, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? ORDER BY id ASC LIMIT 1').get(cartId, parsedId);
      }
    }

    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not in cart.'
      });
    }

    const product = db.prepare('SELECT id, name, stock, status FROM products WHERE id = ?').get(item.product_id);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found.'
      });
    }

    // Validate against current product stock across other cart variants
    const otherVariantsQty = db.prepare(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_items WHERE cart_id = ? AND product_id = ? AND id != ?'
    ).get(cartId, item.product_id, item.id).total;

    if ((otherVariantsQty + parsedQuantity) > product.stock) {
      return res.status(400).json({
        status: 'error',
        message: `Only ${product.stock} items are available.`
      });
    }

    db.prepare(`
      UPDATE cart_items
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(parsedQuantity, item.id);

    const updatedCart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      message: `Updated quantity for "${product.name}".`,
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/cart/items/:idOrProductId
 */
export function removeCartItem(req, res, next) {
  try {
    const rawId = req.params.productId;
    const parsedId = parseInt(rawId, 10);

    if (isNaN(parsedId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid identifier is required.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);
    const requestedSize = (req.query?.size || req.body?.size || '').toString().trim().toUpperCase() || null;

    // Check if parsedId is cart_items.id
    const itemById = db.prepare('SELECT id FROM cart_items WHERE id = ? AND cart_id = ?').get(parsedId, cartId);
    if (itemById) {
      db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemById.id);
    } else if (requestedSize) {
      db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?').run(cartId, parsedId, requestedSize);
    } else {
      // If no size specified, delete matching product_id item(s)
      db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartId, parsedId);
    }

    const updatedCart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      message: 'Item removed from cart.',
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/cart
 */
export function clearCart(req, res, next) {
  try {
    const cartId = getOrCreateUserCart(req.userId);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);

    const updatedCart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      message: 'Cart cleared successfully.',
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}
