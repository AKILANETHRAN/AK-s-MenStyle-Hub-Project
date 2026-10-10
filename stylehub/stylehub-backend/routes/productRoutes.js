import { Router } from '../utils/asyncRouter.js';
import { getAllProducts, getProductById } from '../controllers/productController.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);

export default router;
