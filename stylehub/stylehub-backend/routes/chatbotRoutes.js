import { Router } from '../utils/asyncRouter.js';
import { handleChatMessage } from '../controllers/chatbotController.js';

const router = Router();

// Chatbot endpoint: POST /api/chatbot/message
router.post('/message', handleChatMessage);

export default router;
