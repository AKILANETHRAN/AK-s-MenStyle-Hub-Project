import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getRecentlyAccessed, recordRecentlyAccessed } from '../controllers/recentlyAccessedController.js';

const router = Router();

// Strictly protect all recently accessed routes with JWT
router.use(authMiddleware);

router.get('/', getRecentlyAccessed);
router.post('/', recordRecentlyAccessed);
router.post('/:productId', recordRecentlyAccessed);

export default router;
