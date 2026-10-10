import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import { getProductSizes } from '../utils/sizeHelper.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';

/**
 * Get all products with optional filtering, search, and sorting
 * GET /api/products
 * Query params: category, color, cloth_type, brand, price, minPrice, maxPrice, stock, stockStatus, discount_percent, minDiscount, search, sort
 */
export function getAllProducts(req, res) {
  try {
    const pagination = parsePagination(req.query, 12);
    if (pagination?.error) return res.status(400).json({ status: 'error', message: pagination.error });
    const {
      category,
      color,
      cloth_type,
      brand,
      price,
      minPrice,
      maxPrice,
      stock,
      stockStatus,
      discount_percent,
      minDiscount,
      search,
      sort
    } = req.query;

    let query = `
      SELECT 
        id, name, description, brand, category, cloth_type, color,
        price, original_price, discount_percent, stock, status,
        image, garment_image, vton_supported, vton_garment_category,
        created_at, updated_at
      FROM products
      WHERE 1=1
    `;
    const params = [];

    // Filter by category (case-insensitive match)
    if (category && category !== 'All') {
      query += ` AND LOWER(category) = LOWER(?)`;
      params.push(category.trim());
    }

    // Filter by color
    if (color) {
      query += ` AND LOWER(color) LIKE LOWER(?)`;
      params.push(`%${color.trim()}%`);
    }

    // Filter by cloth_type
    if (cloth_type) {
      query += ` AND LOWER(cloth_type) LIKE LOWER(?)`;
      params.push(`%${cloth_type.trim()}%`);
    }

    // Filter by brand
    if (brand) {
      query += ` AND LOWER(brand) LIKE LOWER(?)`;
      params.push(`%${brand.trim()}%`);
    }

    // Filter by maximum price
    if (price && !isNaN(Number(price))) {
      query += ` AND price <= ?`;
      params.push(Number(price));
    }

    // Range: minPrice and maxPrice
    if (minPrice && !isNaN(Number(minPrice))) {
      query += ` AND price >= ?`;
      params.push(Number(minPrice));
    }
    if (maxPrice && !isNaN(Number(maxPrice))) {
      query += ` AND price <= ?`;
      params.push(Number(maxPrice));
    }

    // Filter by minimum stock
    if (stock && !isNaN(Number(stock))) {
      query += ` AND stock >= ?`;
      params.push(Number(stock));
    }

    // Filter by stock status
    if (stockStatus === 'in_stock') {
      query += ` AND stock > 0`;
    } else if (stockStatus === 'out_of_stock') {
      query += ` AND stock = 0`;
    }

    // Filter by minimum discount percentage
    if (discount_percent && !isNaN(Number(discount_percent))) {
      query += ` AND discount_percent >= ?`;
      params.push(Number(discount_percent));
    }
    if (minDiscount && !isNaN(Number(minDiscount))) {
      query += ` AND discount_percent >= ?`;
      params.push(Number(minDiscount));
    }

    // Search by name, description, brand, color, cloth_type, category (case-insensitive)
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (
        name LIKE ? OR 
        description LIKE ? OR 
        brand LIKE ? OR 
        color LIKE ? OR
        cloth_type LIKE ? OR
        category LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = `SELECT COUNT(*) AS total FROM products ${query.slice(query.indexOf('WHERE 1=1'))}`;

    // Dynamic Sorting
    switch (sort) {
      case 'price_asc':
        query += ` ORDER BY price ASC, id ASC`;
        break;
      case 'price_desc':
        query += ` ORDER BY price DESC, id ASC`;
        break;
      case 'discount_desc':
        query += ` ORDER BY discount_percent DESC, id ASC`;
        break;
      case 'name_asc':
        query += ` ORDER BY name ASC, id ASC`;
        break;
      default:
        query += ` ORDER BY id ASC`;
        break;
    }

    let total;
    if (pagination) {
      total = db.prepare(countQuery).get(...params).total;
      query += ' LIMIT ? OFFSET ?';
      params.push(pagination.pageSize, pagination.offset);
    } else if (req.query.limit !== undefined) {
      const limit = Number(req.query.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ status: 'error', message: 'Limit must be between 1 and 100.' });
      }
      query += ' LIMIT ?';
      params.push(limit);
    }

    const products = db.prepare(query).all(...params);
    const enrichedProducts = products.map(p => ({
      ...p,
      sizes: getProductSizes(p)
    }));
    return res.status(200).json(pagination
      ? { products: enrichedProducts, pagination: paginationMeta(total, pagination) }
      : enrichedProducts);
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve products.' });
  }
}

/**
 * Get single product by ID
 * GET /api/products/:id
 */
export function getProductById(req, res) {
  try {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId) || productId <= 0) {
      return res.status(404).json({ status: 'error', message: 'Invalid product ID.' });
    }

    const product = db.prepare(`
      SELECT 
        id, name, description, brand, category, cloth_type, color,
        price, original_price, discount_percent, stock, status,
        image, garment_image, vton_supported, vton_garment_category,
        created_at, updated_at
      FROM products
      WHERE id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found.' });
    }

    product.sizes = getProductSizes(product);

    // Automatically record recently accessed if authenticated user requests product
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded && decoded.userId) {
          db.prepare(`
            INSERT INTO recently_accessed (user_id, product_id, accessed_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, product_id)
            DO UPDATE SET accessed_at = CURRENT_TIMESTAMP
          `).run(decoded.userId, productId);
        }
      } catch (e) {
        // Silently continue for optional auth
      }
    }

    return res.status(200).json(product);
  } catch (err) {
    console.error('Error fetching product by id:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve product details.' });
  }
}
