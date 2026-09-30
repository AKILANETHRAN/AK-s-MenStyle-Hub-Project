import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/authController.js';
import { googleAuth, getGoogleConfig, getGoogleAuthUrl, handleGoogleCallback, initiateGoogleAuth } from '../controllers/googleAuthController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);

// Google OAuth endpoints
router.get('/google', initiateGoogleAuth);
router.get('/google/config', getGoogleConfig);
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.post('/google', googleAuth);

export default router;
