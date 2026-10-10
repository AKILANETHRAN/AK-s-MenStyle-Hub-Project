import { Router } from '../utils/asyncRouter.js';
import { register, login, getMe, updateProfile, updateUsername, checkUsernameAvailability } from '../controllers/authController.js';
import { googleAuth, getGoogleConfig, getGoogleAuthUrl, handleGoogleCallback, initiateGoogleAuth } from '../controllers/googleAuthController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.put('/username', authMiddleware, updateUsername);
router.get('/check-username', checkUsernameAvailability);

// Google OAuth endpoints
router.get('/google', initiateGoogleAuth);
router.get('/google/config', getGoogleConfig);
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.post('/google', googleAuth);

export default router;
