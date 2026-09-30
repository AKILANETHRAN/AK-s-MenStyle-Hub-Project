import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.patch('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.patch('/:id/read', markAsRead);

export default router;
