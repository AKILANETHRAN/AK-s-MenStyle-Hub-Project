import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import db, { initDatabase, checkDatabaseHealth } from './config/database.js';
import { checkMongoHealth } from './config/mongodb.js';
import { startMongoMirror } from './services/mongoMirror.js';
import { initializeAllRecommendations } from './services/recommendationEngine.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import friendsRoutes from './routes/friendsRoutes.js';
import wishlistShareRoutes from './routes/wishlistShareRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import vtonRoutes from './routes/vtonRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import recentlyAccessedRoutes from './routes/recentlyAccessedRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import mongoRoutes from './routes/mongoRoutes.js';

// Load environment variables before initializing external services.
dotenv.config();

// Initialize PostgreSQL before accepting requests.
await initDatabase();
(await initializeAllRecommendations(db));
const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Health Check Endpoint (supports both /health and /api/health)
app.get(['/health', '/api/health'], async (req, res) => {
  const dbStatus = await checkDatabaseHealth();
  const mongoStatus = await checkMongoHealth();
  let vtonStatus = 'FASHN VTON v1.5 LOCAL (Unavailable)';
  try {
    const vtonServiceUrl = process.env.VTON_SERVICE_URL || process.env.FLASK_VTON_URL || 'http://127.0.0.1:7860';
    const vtonRes = await fetch(`${vtonServiceUrl}/health`, { signal: AbortSignal.timeout(1500) });
    if (vtonRes.ok) {
      const data = await vtonRes.json();
      vtonStatus = data.weights_ready === false
        ? 'FASHN VTON v1.5 LOCAL (Unavailable)'
        : `FASHN VTON v1.5 LOCAL (${data.device || 'CUDA'})`;
    }
  } catch (e) {
    vtonStatus = 'FASHN VTON v1.5 LOCAL';
  }
  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'error',
    service: 'StyleHub Express Backend',
    database: dbStatus,
    mongodb: mongoStatus,
    vton: vtonStatus
  });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Product Catalog Routes
app.use('/api/products', productRoutes);

// Cart Routes
app.use('/api/cart', cartRoutes);

// Wishlist Routes
app.use('/api/wishlist', wishlistRoutes);

// Wishlist Sharing & Feedback Routes
app.use('/api/wishlist/shares', wishlistShareRoutes);

// Friends & Social Routes
app.use('/api/friends', friendsRoutes);

// Notification Routes
app.use('/api/notifications', notificationRoutes);

// Virtual Try-On Routes
app.use('/api/vton', vtonRoutes);

// Simple Purchase Routes (Phase 8)
app.use('/api/purchases', purchaseRoutes);

// Rule-Based Outfit Recommendation Routes (Phase 8)
app.use('/api/recommendations', recommendationRoutes);

// Recently Accessed Routes (Phase 10)
app.use('/api/recently-accessed', recentlyAccessedRoutes);

// Admin Routes (Phase 10)
app.use('/api/admin', adminRoutes);

// Chatbot Assistant Routes (Phase 10)
app.use('/api/chatbot', chatbotRoutes);

// Settings & Preferences Routes (Phase 11)
app.use('/api/settings', settingsRoutes);

// MongoDB mirror inspection routes
app.use('/api', mongoRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server (only when executed directly, not when imported in test suites)
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (process.argv[1].endsWith('server.js') || fileURLToPath(import.meta.url) === process.argv[1]);
if (isMain && process.env.NODE_ENV !== 'test') {
  void startMongoMirror();
  app.listen(PORT, () => {
    console.log(`[StyleHub Backend] Server running on port ${PORT}`);
  });
}

export default app;
