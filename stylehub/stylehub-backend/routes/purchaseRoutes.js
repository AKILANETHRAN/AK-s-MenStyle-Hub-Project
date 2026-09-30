import { Router } from 'express';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { dispatchPurchaseCommunications } from '../services/communicationService.js';

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
    const { productId, quantity, paymentMethod } = req.body || {};

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
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found.' });
    }

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
    const executePurchase = db.transaction(() => {
      // Reduce product stock
      const newStock = product.stock - qty;
      const newStatus = newStock <= 0 ? 'SOLD_OUT' : 'IN_STOCK';
      db.prepare(`
        UPDATE products 
        SET stock = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStock, newStatus, prodId);

      // Insert Purchase record with snapshot of delivery destination
      const purchaseInsert = db.prepare(`
        INSERT INTO purchases (
          user_id, purchase_type, total_amount,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode
        ) VALUES (?, 'SINGLE', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, totalAmount,
        deliveryName, deliveryPhone, deliveryAddress, deliveryCity, deliveryState, deliveryPincode
      );

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Insert Purchase Item with unit price snapshot
      db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_price
        ) VALUES (?, ?, ?, ?)
      `).run(purchaseId, prodId, qty, unitPrice);

      return purchaseId;
    });

    const purchaseId = executePurchase();

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
        quantity: 1
      }));
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      itemList = productIds.map(id => ({
        productId: parseInt(id, 10),
        quantity: 1
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

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(entry.productId);
      if (!product) {
        return res.status(404).json({ status: 'error', message: `Product with ID ${entry.productId} not found.` });
      }

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
    const executeComboPurchase = db.transaction(() => {
      // Deduct stock for each item
      for (const item of resolvedItems) {
        const newStock = item.product.stock - item.quantity;
        const newStatus = newStock <= 0 ? 'SOLD_OUT' : 'IN_STOCK';
        db.prepare(`
          UPDATE products 
          SET stock = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newStock, newStatus, item.product.id);
      }

      // Create purchase header
      const purchaseInsert = db.prepare(`
        INSERT INTO purchases (
          user_id, purchase_type, total_amount,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode
        ) VALUES (?, 'COMBO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, grandTotal,
        deliveryName, deliveryPhone, deliveryAddress, deliveryCity, deliveryState, deliveryPincode
      );

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Create purchase items
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_price
        ) VALUES (?, ?, ?, ?)
      `);

      for (const item of resolvedItems) {
        insertItemStmt.run(purchaseId, item.product.id, item.quantity, item.unitPrice);
      }

      return purchaseId;
    });

    const purchaseId = executeComboPurchase();

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
          quantity: it.quantity,
          unit_price: it.unitPrice,
          line_total: it.lineTotal
        }))
      },
      notifications
    });
  } catch (err) {
    console.error('Error processing combo purchase:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to process combo purchase.' });
  }
});

/**
 * GET /api/purchases
 * Return authenticated user's purchase history.
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    const purchases = db.prepare(`
      SELECT * FROM purchases
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    const itemsStmt = db.prepare(`
      SELECT pi.*, p.name AS product_name, p.image AS product_image, p.category, p.cloth_type, p.brand
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `);

    const result = purchases.map(p => ({
      ...p,
      items: itemsStmt.all(p.id)
    }));

    return res.status(200).json({
      status: 'success',
      purchases: result
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
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const purchaseId = parseInt(req.params.id, 10);

    if (isNaN(purchaseId) || purchaseId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid purchase ID.' });
    }

    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
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

    const items = db.prepare(`
      SELECT pi.*, p.name AS product_name, p.image AS product_image, p.category, p.cloth_type, p.brand
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchase.id);

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

export default router;
