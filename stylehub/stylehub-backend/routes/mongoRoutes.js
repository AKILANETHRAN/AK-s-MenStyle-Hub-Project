import { Router } from 'express';
import { getMirroredOrder, getMirroredUser } from '../controllers/mongoController.js';

const router = Router();

// Read-only views of the SQLite records mirrored into MongoDB.
router.get('/users/:id', getMirroredUser);
router.get('/orders/:id', getMirroredOrder);

export default router;
