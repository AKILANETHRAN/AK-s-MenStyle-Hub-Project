/** Reserve stock atomically within the purchase transaction. */
export async function reserveStock(db, productId, quantity) {
  const result = await db.prepare(`UPDATE products
    SET stock = stock - ?,
        status = CASE WHEN stock - ? = 0 THEN 'SOLD_OUT' ELSE 'IN_STOCK' END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND stock >= ? AND status = 'IN_STOCK'
  `).run(quantity, quantity, productId, quantity);
  if (result.changes !== 1) {
    const error = new Error('Product stock changed. Please refresh your cart and try again.');
    error.code = 'OUT_OF_STOCK';
    throw error;
  }
}
