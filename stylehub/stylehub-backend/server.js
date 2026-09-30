import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import db, { initDatabase, checkDatabaseHealth } from './config/database.js';
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

dotenv.config();

// Initialize SQLite database, tables, and indexes
initDatabase();
initializeAllRecommendations(db);

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = checkDatabaseHealth();
  let vtonStatus = 'FASHN VTON v1.5 LOCAL (Ready)';
  try {
    const vtonRes = await fetch('http://127.0.0.1:7860/health', { signal: AbortSignal.timeout(1500) });
    if (vtonRes.ok) {
      const data = await vtonRes.json();
      vtonStatus = `FASHN VTON v1.5 LOCAL (${data.device || 'CUDA'})`;
    }
  } catch (e) {
    vtonStatus = 'FASHN VTON v1.5 LOCAL';
  }
  res.status(200).json({
    status: 'ok',
    service: 'StyleHub Express Backend',
    database: dbStatus,
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

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`[StyleHub Backend] Server running on port ${PORT}`);
});
