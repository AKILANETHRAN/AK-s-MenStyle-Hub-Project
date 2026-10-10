import { Router } from '../utils/asyncRouter.js';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { dispatchPurchaseCommunications } from '../services/communicationService.js';
import { calculateCartReward } from '../services/cartRewardService.js';
import { sendPurchaseSuccessEmail } from '../services/emailService.js';
import { validateProductSize } from '../utils/sizeHelper.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { reserveStock } from '../services/stockService.js';

const router = Router();

/**
 * Validates that the delivery profile has all mandatory fields completed.
 * Required: full_name, phone, address, city, state, pincode.
 */
function validateDeliveryAddress(user) {
  const name = user.fullName || user.full_name;
  if (!name || !String(name).trim()) return false;
  if (!user.phone || !String(user.phone).trim()) return false;
  if (!user.address || !String(user.address).trim()) return false;
  if (!user.city || !String(user.city).trim()) return false;
  if (!user.state || !String(user.state).trim()) return false;
  if (!user.pincode || !String(user.pincode).trim()) return false;
  return true;
}

/**
 * POST /api/purchases/product
 * Purchase a single product directly.
 */
router.post('/product', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;
    const { productId, quantity, paymentMethod, size } = req.body || {};

    // Requirement 16: Direct single product purchase quantity MUST strictly be 1
    if (quantity !== undefined && parseInt(quantity, 10) !== 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Direct single product purchase quantity must strictly be 1.'
      });
    }
    const qty = 1;
    const prodId = parseInt(productId, 10);

    if (isNaN(prodId) || prodId <= 0) {
      return res.status(400).json({ status: 'error', message: 'A valid productId is required.' });
    }

    // 1. Address Validation
    if (!validateDeliveryAddress(user)) {
      return res.status(400).json({
        status: 'error',
        code: 'ADDRESS_INCOMPLETE',
        message: 'Please complete your delivery address in Profile before purchasing.'
      });
    }

    // 2. Fetch Product & Validate Stock
    const product = (await db.prepare('SELECT * FROM products WHERE id = ?').get(prodId));
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found.' });
    }

    // 2b. Size Validation for Clothing vs Accessories
    const sizeValidation = validateProductSize(product, size);
    if (!sizeValidation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: sizeValidation.error
      });
    }
    const validatedSize = sizeValidation.size;

    if (product.stock < qty || product.status === 'SOLD_OUT') {
      return res.status(400).json({
        status: 'error',
        code: 'OUT_OF_STOCK',
        message: 'Selected product is out of stock.'
      });
    }

    // 3. Price Calculation (Authoritative DB Price)
    const unitPrice = product.price;
    const totalAmount = Math.round(unitPrice * qty * 100) / 100;

    const deliveryName = user.fullName || user.full_name;
    const deliveryPhone = user.phone;
    const deliveryAddress = user.address;
    const deliveryCity = user.city;
    const deliveryState = user.state;
    const deliveryPincode = user.pincode;

    // 4. Atomic Transaction: Deduct stock + Create Purchase + Create Purchase Item
    const executePurchase = db.transaction(async () => {
      // Reduce product stock
      await reserveStock(db, prodId, qty);

      // Insert Purchase record with snapshot of delivery destination
      const purchaseInsert = (await db.prepare(`
        INSERT INTO purchases (
          user_id, purchase_type, total_amount,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode
        ) VALUES (?, 'SINGLE', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, totalAmount,
        deliveryName, deliveryPhone, deliveryAddress, deliveryCity, deliveryState, deliveryPincode
      ));

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Insert Purchase Item with unit price snapshot and size
      (await db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_price, size
        ) VALUES (?, ?, ?, ?, ?)
      `).run(purchaseId, prodId, qty, unitPrice, validatedSize));

      return purchaseId;
    });

    const purchaseId = (await executePurchase());

    // 5. Asynchronous Communication Dispatch (Non-fatal, safe post-commit)
    let notifications = {
      email: { status: 'NOT_CONFIGURED' },
      sms: { status: 'NOT_CONFIGURED' },
      whatsapp: { status: 'NOT_CONFIGURED' }
    };
    try {
      notifications = await dispatchPurchaseCommunications(purchaseId, userId);
    } catch (notifErr) {
      console.error('[COMMUNICATION] Post-purchase dispatch error (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      status: 'success',
      message: 'PURCHASE SUCCESSFUL',
      purchase: {
        id: purchaseId,
        purchase_type: 'SINGLE',
        total_amount: totalAmount,
        delivery_name: deliveryName,
        delivery_phone: deliveryPhone,
        delivery_address: deliveryAddress,
        delivery_city: deliveryCity,
        delivery_state: deliveryState,
        delivery_pincode: deliveryPincode,
        created_at: new Date().toISOString(),
        items: [
          {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image,
            cloth_type: product.cloth_type,
            size: validatedSize,
            quantity: qty,
            unit_price: unitPrice,
            line_total: totalAmount
          }
        ]
      },
      notifications
    });
  } catch (err) {
    console.error('Error processing single product purchase:', err);
    if (err.code === 'OUT_OF_STOCK') return res.status(409).json({ status: 'error', code: err.code, message: err.message });
    return res.status(500).json({ status: 'error', message: 'Failed to process purchase.' });
  }
});

/**
 * POST /api/purchases/combo
 * Purchase a recommended outfit combo directly.
 */
router.post('/combo', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;
    const { productIds, items } = req.body;

    // Requirement 17: Every selected product in complete outfit combo MUST have quantity = 1
    let itemList = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (it.quantity !== undefined && parseInt(it.quantity, 10) !== 1) {
          return res.status(400).json({
            status: 'error',
            message: 'Every piece in a complete outfit combo purchase must strictly have quantity = 1.'
          });
        }
      }
      itemList = items.map(it => ({
        productId: parseInt(it.productId, 10),
        quantity: 1,
        size: it.size || null
      }));
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      itemList = productIds.map(id => ({
        productId: parseInt(id, 10),
        quantity: 1,
        size: null
      }));
    }

    if (itemList.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'A combo purchase requires at least 2 compatible items.'
      });
    }

    // 1. Address Validation
    if (!validateDeliveryAddress(user)) {
      return res.status(400).json({
        status: 'error',
        code: 'ADDRESS_INCOMPLETE',
        message: 'Please complete your delivery address in Profile before purchasing.'
      });
    }

    // 2. Fetch and Validate EVERY product before touching ANY stock
    const resolvedItems = [];
    let grandTotal = 0;

    for (const entry of itemList) {
      if (isNaN(entry.productId) || entry.productId <= 0) {
        return res.status(400).json({ status: 'error', message: `Invalid product ID: ${entry.productId}` });
      }

      const product = (await db.prepare('SELECT * FROM products WHERE id = ?').get(entry.productId));
      if (!product) {
        return res.status(404).json({ status: 'error', message: `Product with ID ${entry.productId} not found.` });
      }

      // Validate size for clothing vs accessories
      const sizeValidation = validateProductSize(product, entry.size);
      if (!sizeValidation.isValid) {
        return res.status(400).json({
          status: 'error',
          message: `Size error for "${product.name}": ${sizeValidation.error}`
        });
      }
      const validatedSize = sizeValidation.size;

      // Strict stock validation for every item
      if (product.stock < entry.quantity || product.status === 'SOLD_OUT') {
        return res.status(400).json({
          status: 'error',
          code: 'OUT_OF_STOCK',
          message: 'One or more products in this outfit are currently out of stock.'
        });
      }

      const lineTotal = Math.round(product.price * entry.quantity * 100) / 100;
      grandTotal += lineTotal;

      resolvedItems.push({
        product,
        quantity: entry.quantity,
        size: validatedSize,
        unitPrice: product.price,
        lineTotal
      });
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    const deliveryName = user.fullName || user.full_name;
    const deliveryPhone = user.phone;
    const deliveryAddress = user.address;
    const deliveryCity = user.city;
    const deliveryState = user.state;
    const deliveryPincode = user.pincode;

    // 3. Atomic Transaction: Deduct stock for all items + create purchase + create items
    const executeComboPurchase = db.transaction(async () => {
      // Deduct stock for each item
      for (const item of resolvedItems) {
        await reserveStock(db, item.product.id, item.quantity);
      }

      // Create purchase header
      const purchaseInsert = (await db.prepare(`
        INSERT INTO purchases (
          user_id, purchase_type, total_amount,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode
        ) VALUES (?, 'COMBO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, grandTotal,
        deliveryName, deliveryPhone, deliveryAddress, deliveryCity, deliveryState, deliveryPincode
      ));

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Create purchase items with size
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_price, size
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of resolvedItems) {
        (await insertItemStmt.run(purchaseId, item.product.id, item.quantity, item.unitPrice, item.size));
      }

      return purchaseId;
    });

    const purchaseId = (await executeComboPurchase());

    // 4. Asynchronous Communication Dispatch (Non-fatal, safe post-commit)
    let notifications = {
      email: { status: 'NOT_CONFIGURED' },
      sms: { status: 'NOT_CONFIGURED' },
      whatsapp: { status: 'NOT_CONFIGURED' }
    };
    try {
      notifications = await dispatchPurchaseCommunications(purchaseId, userId);
    } catch (notifErr) {
      console.error('[COMMUNICATION] Post-combo dispatch error (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      status: 'success',
      message: 'PURCHASE SUCCESSFUL',
      purchase: {
        id: purchaseId,
        purchase_type: 'COMBO',
        total_amount: grandTotal,
        delivery_name: deliveryName,
        delivery_phone: deliveryPhone,
        delivery_address: deliveryAddress,
        delivery_city: deliveryCity,
        delivery_state: deliveryState,
        delivery_pincode: deliveryPincode,
        created_at: new Date().toISOString(),
        items: resolvedItems.map(it => ({
          product_id: it.product.id,
          product_name: it.product.name,
          product_image: it.product.image,
          cloth_type: it.product.cloth_type,
          size: it.size,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          line_total: it.lineTotal
        }))
      },
      notifications
    });
  } catch (err) {
    console.error('Error processing combo purchase:', err);
    if (err.code === 'OUT_OF_STOCK') return res.status(409).json({ status: 'error', code: err.code, message: err.message });
    return res.status(500).json({ status: 'error', message: 'Failed to process combo purchase.' });
  }
});

/**
 * POST /api/purchases/cart
 * Purchase all items in authenticated user's active cart with Buy More, Save More rewards.
 */
router.post('/cart', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    const deliveryName = req.body?.deliveryName || req.body?.fullName || user.fullName || user.full_name;
    const deliveryPhone = req.body?.phone || req.body?.deliveryPhone || user.phone;
    const deliveryAddress = req.body?.address || req.body?.deliveryAddress || user.address;
    const deliveryCity = req.body?.city || req.body?.deliveryCity || user.city;
    const deliveryState = req.body?.state || req.body?.deliveryState || user.state;
    const deliveryPincode = req.body?.pincode || req.body?.deliveryPincode || user.pincode;

    const effectiveDelivery = {
      fullName: deliveryName,
      phone: deliveryPhone,
      address: deliveryAddress,
      city: deliveryCity,
      state: deliveryState,
      pincode: deliveryPincode
    };

    // 1. Address Validation
    if (!validateDeliveryAddress(effectiveDelivery)) {
      return res.status(400).json({
        status: 'error',
        code: 'ADDRESS_INCOMPLETE',
        message: 'Please complete your delivery address before purchasing.'
      });
    }

    // 2. Fetch User Cart
    const cart = (await db.prepare('SELECT id FROM cart WHERE user_id = ?').get(userId));
    if (!cart) {
      return res.status(400).json({ status: 'error', message: 'Your shopping cart is currently empty.' });
    }

    const cartItems = (await db.prepare(`
      SELECT ci.product_id, ci.size, ci.quantity, p.name, p.price, p.stock, p.status, p.image, p.cloth_type
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
    `).all(cart.id));

    if (!cartItems.length) {
      return res.status(400).json({ status: 'error', message: 'Your shopping cart is currently empty.' });
    }

    // 3. Stock Validation
    for (const it of cartItems) {
      if (it.stock < it.quantity || it.status === 'SOLD_OUT') {
        return res.status(400).json({
          status: 'error',
          code: 'OUT_OF_STOCK',
          message: `Product "${it.name}" has insufficient stock (${it.stock} remaining). Please update your cart.`
        });
      }
    }

    // 4. Authoritative Subtotal & Cart Reward Calculation (Never trust client pricing)
    let subtotal = 0;
    const resolvedItems = [];
    for (const it of cartItems) {
      const lineTotal = Math.round(it.price * it.quantity * 100) / 100;
      subtotal += lineTotal;
      resolvedItems.push({
        productId: it.product_id,
        size: it.size || null,
        productName: it.name,
        productImage: it.image,
        clothType: it.cloth_type,
        quantity: it.quantity,
        unitPrice: it.price,
        lineTotal
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const reward = calculateCartReward(subtotal);
    const grandTotal = reward.finalTotal;

    const purchaseType = resolvedItems.length > 1 ? 'COMBO' : 'SINGLE';

    // 5. Atomic Transaction: Deduct stock, insert purchase + items, clear cart
    const executeCartPurchase = db.transaction(async () => {
      // Deduct stock for each cart item
      for (const it of resolvedItems) {
        await reserveStock(db, it.productId, it.quantity);
      }

      // Create purchase header
      const purchaseInsert = (await db.prepare(`
        INSERT INTO purchases (
          user_id, purchase_type, total_amount, subtotal, cart_reward_percent, cart_reward_amount,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, purchaseType, grandTotal, subtotal, reward.percentage, reward.rewardAmount,
        deliveryName, deliveryPhone, deliveryAddress, deliveryCity, deliveryState, deliveryPincode
      ));

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Create purchase items with size
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_price, size
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const it of resolvedItems) {
        (await insertItemStmt.run(purchaseId, it.productId, it.quantity, it.unitPrice, it.size));
      }

      // Clear user's cart items
      (await db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id));

      return purchaseId;
    });

    const purchaseId = (await executeCartPurchase());

    // 6. Asynchronous Notification Dispatch
    let notifications = {
      email: { status: 'NOT_CONFIGURED' },
      sms: { status: 'NOT_CONFIGURED' },
      whatsapp: { status: 'NOT_CONFIGURED' }
    };
    try {
      notifications = await dispatchPurchaseCommunications(purchaseId, userId);
    } catch (notifErr) {
      console.error('[COMMUNICATION] Post-cart dispatch error (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      status: 'success',
      message: 'PURCHASE SUCCESSFUL',
      purchase: {
        id: purchaseId,
        purchase_type: purchaseType,
        subtotal,
        cart_reward_percent: reward.percentage,
        cart_reward_amount: reward.rewardAmount,
        total_amount: grandTotal,
        delivery_name: deliveryName,
        delivery_phone: deliveryPhone,
        delivery_address: deliveryAddress,
        delivery_city: deliveryCity,
        delivery_state: deliveryState,
        delivery_pincode: deliveryPincode,
        created_at: new Date().toISOString(),
        items: resolvedItems.map(it => ({
          product_id: it.productId,
          product_name: it.productName,
          product_image: it.productImage,
          cloth_type: it.clothType,
          size: it.size,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          line_total: it.lineTotal
        })),
        cartReward: reward
      },
      notifications
    });
  } catch (err) {
    console.error('Error processing cart purchase:', err);
    if (err.code === 'OUT_OF_STOCK') return res.status(409).json({ status: 'error', code: err.code, message: err.message });
    return res.status(500).json({ status: 'error', message: 'Failed to process cart purchase.' });
  }
});

/**
 * GET /api/purchases
 * Return authenticated user's purchase history.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const pagination = parsePagination(req.query, 10);
    if (pagination?.error) return res.status(400).json({ status: 'error', message: pagination.error });
    const total = pagination
      ? (await db.prepare('SELECT COUNT(*) AS total FROM purchases WHERE user_id = ?').get(userId)).total
      : null;

    const query = `
      SELECT * FROM purchases
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      ${pagination ? 'LIMIT ? OFFSET ?' : ''}
    `;
    const purchases = (await db.prepare(query).all(...(pagination
      ? [userId, pagination.pageSize, pagination.offset]
      : [userId])));

    const itemsStmt = db.prepare(`
      SELECT pi.*, p.name AS product_name, p.image AS product_image, p.category, p.cloth_type, p.brand
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `);

    const result = (await Promise.all(purchases.map(async p => ({
      ...p,
      items: (await itemsStmt.all(p.id))
    }))));

    return res.status(200).json({
      status: 'success',
      purchases: result,
      ...(pagination ? { pagination: paginationMeta(total, pagination) } : {})
    });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch purchase history.' });
  }
});

/**
 * GET /api/purchases/:id
 * Return purchase details with strict user isolation.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const purchaseId = parseInt(req.params.id, 10);

    if (isNaN(purchaseId) || purchaseId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid purchase ID.' });
    }

    const purchase = (await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId));
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Purchase not found.' });
    }

    // Strict User Isolation Check
    if (purchase.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view this purchase.'
      });
    }

    const items = (await db.prepare(`
      SELECT pi.*, p.name AS product_name, p.image AS product_image, p.category, p.cloth_type, p.brand
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchase.id));

    return res.status(200).json({
      status: 'success',
      purchase: {
        ...purchase,
        items
      }
    });
  } catch (err) {
    console.error('Error fetching purchase by ID:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch purchase.' });
  }
});

/**
 * POST /api/purchases/:id/resend-email
 * Protected manual resend endpoint. Strictly requires JWT + ownership or ADMIN role.
 * Never accepts arbitrary recipient emails.
 */
router.post('/:id/resend-email', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    const purchaseId = parseInt(req.params.id, 10);

    if (isNaN(purchaseId) || purchaseId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid purchase ID.' });
    }

    const purchase = (await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId));
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Purchase not found.' });
    }

    // Strict ownership / ADMIN permission check
    if (purchase.user_id !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to resend notification for this purchase.'
      });
    }

    // Force resend bypassing duplicate suppression
    const result = await sendPurchaseSuccessEmail(purchaseId, purchase.user_id, { forceResend: true });

    return res.status(200).json({
      status: 'success',
      message: 'Email dispatch initiated.',
      delivery: result
    });
  } catch (err) {
    console.error('Error resending purchase email:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to resend purchase email.' });
  }
});

export default router;
