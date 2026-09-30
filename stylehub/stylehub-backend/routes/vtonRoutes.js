import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max file size
});

const FLASK_VTON_URL = process.env.FLASK_VTON_URL || 'http://127.0.0.1:7860';

/**
 * GET /api/vton/status
 * Check local Flask FASHN VTON service availability
 */
router.get('/status', async (req, res) => {
  try {
    const response = await fetch(`${FLASK_VTON_URL}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        available: true,
        service: 'FASHN VTON v1.5 LOCAL',
        ...data
      });
    }
    return res.status(503).json({
      available: false,
      service: 'FASHN VTON v1.5 LOCAL',
      message: 'Virtual try-on service returned non-OK status.'
    });
  } catch (error) {
    return res.status(503).json({
      available: false,
      service: 'FASHN VTON v1.5 LOCAL',
      message: 'Virtual try-on service is currently unavailable.'
    });
  }
});

/**
 * GET /api/vton/history
 * Retrieve user's past virtual try-on results
 */
router.get('/history', authMiddleware, (req, res) => {
  try {
    const results = db.prepare(`
      SELECT r.*, p.name AS product_name, p.brand AS product_brand, p.category AS product_category
      FROM try_on_results r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.id DESC
      LIMIT 20
    `).all(req.userId);

    return res.status(200).json({
      success: true,
      results
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve try-on history.' });
  }
});

/**
 * GET /api/vton/results/:id
 * Retrieve a specific try-on result with strict user ownership isolation
 */
router.get('/results/:id', authMiddleware, (req, res) => {
  try {
    const resultId = parseInt(req.params.id, 10);
    const result = db.prepare(`
      SELECT * FROM try_on_results WHERE id = ?
    `).get(resultId);

    if (!result) {
      return res.status(404).json({ error: 'Try-on result not found.' });
    }

    // Ownership check: User A cannot access User B's result
    if (result.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied to this try-on result.' });
    }

    return res.status(200).json({
      success: true,
      result
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve result.' });
  }
});

/**
 * POST /api/vton/try-on
 * Main Virtual Try-On inference execution endpoint
 */
router.post('/try-on', authMiddleware, upload.single('user_photo'), async (req, res) => {
  try {
    // 1. Validate Product ID
    const rawProductId = req.body.productId || req.body.product_id;
    if (!rawProductId) {
      return res.status(400).json({ error: 'Selected product could not be found.' });
    }

    const productId = parseInt(rawProductId, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Selected product could not be found.' });
    }

    // 2. Fetch and Validate Product from SQLite
    const product = db.prepare(`
      SELECT * FROM products WHERE id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({ error: 'Selected product could not be found.' });
    }

    if (product.vton_supported !== 1) {
      return res.status(400).json({ error: 'Virtual try-on is not available for this product.' });
    }

    if (!product.garment_image) {
      return res.status(400).json({ error: 'The selected garment is currently unavailable for virtual try-on.' });
    }

    // 3. Validate User Photo
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'Please upload your photo first.' });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype.toLowerCase())) {
      return res.status(400).json({ error: 'Please upload a valid JPG, PNG, or WebP image.' });
    }

    // 4. Resolve exact garment asset on disk
    const cleanRelPath = product.garment_image.startsWith('/')
      ? product.garment_image.slice(1)
      : product.garment_image;
    const garmentDiskPath = path.join(__dirname, '..', 'public', cleanRelPath);

    if (!fs.existsSync(garmentDiskPath)) {
      return res.status(400).json({ error: 'The selected garment is currently unavailable for virtual try-on.' });
    }

    const garmentBuffer = fs.readFileSync(garmentDiskPath);

    // 5. Prepare request for local Flask FASHN service
    const category = product.vton_garment_category || (product.category === 'Pants & Trousers' ? 'bottoms' : 'tops');
    const formData = new FormData();

    const userPhotoBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('person_image', userPhotoBlob, req.file.originalname || 'user_photo.png');

    const garmentBlob = new Blob([garmentBuffer], { type: 'image/png' });
    formData.append('garment_image', garmentBlob, path.basename(garmentDiskPath));

    const numTimesteps = req.body.num_timesteps || '12';
    formData.append('category', category);
    formData.append('num_timesteps', String(numTimesteps));
    formData.append('guidance_scale', '1.5');
    formData.append('seed', '42');

    let flaskResponse;
    try {
      flaskResponse = await fetch(`${FLASK_VTON_URL}/try-on`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(1200000) // 20 minute timeout for diffusion inference on RTX 2050
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'TimeoutError') {
        return res.status(504).json({ error: 'The AI try-on took too long to complete. Please try again.' });
      }
      return res.status(503).json({ error: 'Virtual try-on service is currently unavailable.' });
    }

    if (!flaskResponse.ok) {
      if (flaskResponse.status === 503 || flaskResponse.status === 429) {
        return res.status(503).json({ error: 'Another virtual try-on is currently being generated. Please wait.' });
      }
      return res.status(500).json({ error: 'Virtual try-on could not be generated. Please try again.' });
    }

    // 6. Read generated image output
    const outputBuffer = Buffer.from(await flaskResponse.arrayBuffer());
    if (outputBuffer.length === 0) {
      return res.status(500).json({ error: 'Virtual try-on could not be generated. Please try again.' });
    }

    // 7. Save generated output to disk
    const timestamp = Date.now();
    const resultFilename = `tryon_user_${req.userId}_prod_${product.id}_${timestamp}.png`;
    const backendResultDir = path.join(__dirname, '..', 'public', 'images', 'try-on');
    const frontendResultDir = path.join(__dirname, '..', '..', 'stylehub-frontend', 'public', 'images', 'try-on');

    if (!fs.existsSync(backendResultDir)) {
      fs.mkdirSync(backendResultDir, { recursive: true });
    }
    const backendSavePath = path.join(backendResultDir, resultFilename);
    fs.writeFileSync(backendSavePath, outputBuffer);

    // Also mirror to frontend public folder for immediate static serving if available
    try {
      if (fs.existsSync(frontendResultDir)) {
        fs.writeFileSync(path.join(frontendResultDir, resultFilename), outputBuffer);
      }
    } catch (copyErr) {
      // Non-fatal if frontend path differs
    }

    const resultRelUrl = `/images/try-on/${resultFilename}`;

    // 8. Persist to SQLite try_on_results
    const insertStmt = db.prepare(`
      INSERT INTO try_on_results (
        user_id, product_id, user_image_path, garment_image_path,
        generated_image_path, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
    `);

    const insertResult = insertStmt.run(
      req.userId,
      product.id,
      `user_upload_${timestamp}`,
      product.garment_image,
      resultRelUrl,
      category
    );

    return res.status(200).json({
      success: true,
      result_id: insertResult.lastInsertRowid,
      result_url: resultRelUrl,
      product_id: product.id,
      product_name: product.name,
      garment_image: product.garment_image,
      category
    });

  } catch (err) {
    console.error('[VTON Error]', err);
    return res.status(500).json({ error: 'Virtual try-on could not be generated. Please try again.' });
  }
});

export default router;
