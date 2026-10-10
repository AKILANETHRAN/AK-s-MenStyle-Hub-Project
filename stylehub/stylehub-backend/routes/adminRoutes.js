import { Router } from 'express';
import { requireAdmin } from '../middleware/authMiddleware.js';
import db from '../config/database.js';
import { getMessageTemplates, MESSAGE_CHANNELS, validateMessageTemplate } from '../services/messageTemplateService.js';
import {
  getAdminMetrics,
  getAdminProducts,
  updateAdminProduct,
  getAdminUsers,
  getAdminPurchases,
  getAdminVtonStats,
  getAdminRecentActivity,
  getAdminEmailStatus
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
router.get('/email/status', getAdminEmailStatus);
router.get('/message-templates', (req, res) => {
  res.json({ status: 'success', templates: getMessageTemplates() });
});
router.put('/message-templates', (req, res) => {
  const { channel, body } = req.body || {};
  if (!MESSAGE_CHANNELS.includes(channel)) return res.status(400).json({ status: 'error', message: 'Invalid channel.' });
  const error = validateMessageTemplate(body);
  if (error) return res.status(400).json({ status: 'error', message: error });
  db.prepare(`INSERT INTO message_templates (channel, body, updated_by)
    VALUES (?, ?, ?)
    ON CONFLICT(channel) DO UPDATE SET body = excluded.body, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`
  ).run(channel, body.trim(), req.userId);
  res.json({ status: 'success', templates: getMessageTemplates() });
});

export default router;
