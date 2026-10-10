import { Router } from '../utils/asyncRouter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getWishlist,
  addToWishlist,
  removeWishlistItem,
  clearWishlist
} from '../controllers/wishlistController.js';

const router = Router();

// Enforce JWT authentication on all wishlist endpoints
router.use(authMiddleware);

router.get('/', getWishlist);
router.post('/items', addToWishlist);
router.delete('/items/:productId', removeWishlistItem);
router.delete('/', clearWishlist);

export default router;
