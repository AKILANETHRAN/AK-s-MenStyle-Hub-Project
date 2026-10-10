import { Router } from '../utils/asyncRouter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
} from '../controllers/cartController.js';

const router = Router();

// Enforce JWT authentication on all cart endpoints
router.use(authMiddleware);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:productId', updateCartItemQuantity);
router.delete('/items/:productId', removeCartItem);
router.delete('/', clearCart);

export default router;
