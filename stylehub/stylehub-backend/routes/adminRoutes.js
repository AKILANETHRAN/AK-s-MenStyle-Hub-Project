import { Router } from 'express';
import { requireAdmin } from '../middleware/authMiddleware.js';
import {
  getAdminMetrics,
  getAdminProducts,
  updateAdminProduct,
  getAdminUsers,
  getAdminPurchases,
  getAdminVtonStats,
  getAdminRecentActivity
} from '../controllers/adminController.js';

const router = Router();

// Strictly protect all admin routes with requireAdmin middleware
router.use(requireAdmin);

router.get('/metrics', getAdminMetrics);
router.get('/products', getAdminProducts);
router.patch('/products/:id', updateAdminProduct);
router.get('/users', getAdminUsers);
router.get('/purchases', getAdminPurchases);
router.get('/vton-stats', getAdminVtonStats);
router.get('/recent-activity', getAdminRecentActivity);

export default router;
