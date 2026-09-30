import db from '../config/database.js';

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
      p.status
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

  return {
    items: formattedItems,
    totalItems,
    subtotal: Math.round(subtotal * 100) / 100
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
 * Body: { productId: number, quantity?: number }
 */
export function addToCart(req, res, next) {
  try {
    const { productId, quantity = 1 } = req.body;
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
    const product = db.prepare('SELECT id, name, stock, status, price FROM products WHERE id = ?').get(parsedProductId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found.'
      });
    }

    // 2. Stock check: Stock = 0 -> reject "Out of stock."
    if (product.stock === 0 || product.status === 'SOLD_OUT') {
      return res.status(400).json({
        status: 'error',
        message: 'Out of stock.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);

    // 3. Check existing item in cart
    const existing = db.prepare('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, parsedProductId);
    const existingQty = existing ? existing.quantity : 0;
    const targetQty = existingQty + parsedQuantity;

    // 4. Validate quantity against stock: NEVER allow cart quantity > stock
    if (targetQty > product.stock) {
      return res.status(400).json({
        status: 'error',
        message: `Only ${product.stock} items are available.`
      });
    }

    // 5. Insert or update atomically
    db.prepare(`
      INSERT INTO cart_items (cart_id, product_id, quantity, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cart_id, product_id) DO UPDATE SET
        quantity = ?,
        updated_at = CURRENT_TIMESTAMP
    `).run(cartId, parsedProductId, targetQty, targetQty);

    const updatedCart = getFormattedCart(req.userId);
    return res.status(200).json({
      status: 'success',
      message: `Added "${product.name}" to cart.`,
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/cart/items/:productId
 * Body: { quantity: number }
 */
export function updateCartItemQuantity(req, res, next) {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
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

    const product = db.prepare('SELECT id, name, stock, status FROM products WHERE id = ?').get(parsedProductId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);
    const existing = db.prepare('SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, parsedProductId);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not in cart.'
      });
    }

    // Validate against current product stock
    if (parsedQuantity > product.stock) {
      return res.status(400).json({
        status: 'error',
        message: `Only ${product.stock} items are available.`
      });
    }

    db.prepare(`
      UPDATE cart_items
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cart_id = ? AND product_id = ?
    `).run(parsedQuantity, cartId, parsedProductId);

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
 * DELETE /api/cart/items/:productId
 */
export function removeCartItem(req, res, next) {
  try {
    const { productId } = req.params;
    const parsedProductId = parseInt(productId, 10);

    if (isNaN(parsedProductId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid productId is required.'
      });
    }

    const cartId = getOrCreateUserCart(req.userId);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartId, parsedProductId);

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
