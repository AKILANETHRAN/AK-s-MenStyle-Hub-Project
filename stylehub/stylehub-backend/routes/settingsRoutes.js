import { Router } from 'express';
import { getSettings, updateSettings, getNotificationHistory } from '../controllers/settingsController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/notifications/history', getNotificationHistory);

export default router;
