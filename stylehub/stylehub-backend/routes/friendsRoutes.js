import { Router } from '../utils/asyncRouter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getFriends,
  searchUsers,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
} from '../controllers/friendsController.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getFriends);
router.get('/search', searchUsers);
router.get('/requests', getFriendRequests);
router.post('/request', sendFriendRequest);
router.post('/:id/accept', acceptFriendRequest);
router.post('/:id/reject', rejectFriendRequest);
router.delete('/:id', removeFriend);

export default router;
