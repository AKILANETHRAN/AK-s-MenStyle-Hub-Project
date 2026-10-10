import { Router } from '../utils/asyncRouter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  createWishlistShare,
  getWishlistShares,
  getWishlistShareById,
  addShareFeedback
} from '../controllers/wishlistShareController.js';

const router = Router();

router.use(authMiddleware);

router.post('/', createWishlistShare);
router.get('/', getWishlistShares);
router.get('/:shareId', getWishlistShareById);
router.post('/:shareId/feedback', addShareFeedback);

export default router;
