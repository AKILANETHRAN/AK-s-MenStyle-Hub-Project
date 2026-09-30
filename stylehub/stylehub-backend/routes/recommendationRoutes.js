import { Router } from 'express';
import db from '../config/database.js';
import { getRecommendationsForProduct } from '../services/recommendationEngine.js';

const router = Router();

/**
 * GET /api/recommendations/product/:productId
 * Returns rule-based outfit recommendations for a product.
 * - Eligible: Tops (1-20, 31-50) and Bottoms (21-30). Returns { available: true, signature, anchorProduct, recommendations }
 * - Accessories: Shoes, Watches, Caps, Belts, Sunglasses (51-100). Returns { available: false, reason: "..." }
 */
router.get('/product/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const numericId = parseInt(productId, 10);

    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid numeric product ID is required.'
      });
    }

    const data = getRecommendationsForProduct(numericId, db);

    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: `Product with ID ${numericId} not found.`
      });
    }

    if (!data.available) {
      return res.status(200).json({
        status: 'success',
        available: false,
        reason: data.reason || 'Recommendations are only available for tops and bottoms',
        recommendations: []
      });
    }

    return res.status(200).json({
      status: 'success',
      available: true,
      signature: data.signature,
      anchorProduct: data.anchorProduct,
      recommendations: data.recommendations
    });
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate recommendations.'
    });
  }
});

export default router;
