import { Router } from '../utils/asyncRouter.js';
import { getMirroredOrder, getMirroredUser } from '../controllers/mongoController.js';

const router = Router();

// Read-only views of the PostgreSQL records mirrored into MongoDB.
router.get('/users/:id', getMirroredUser);
router.get('/orders/:id', getMirroredOrder);

export default router;
