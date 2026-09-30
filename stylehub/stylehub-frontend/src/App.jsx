import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import WishlistPage from './pages/WishlistPage';
import FriendsPage from './pages/FriendsPage';
import CartPage from './pages/CartPage';
import PurchasesPage from './pages/PurchasesPage';
import ProfilePage from './pages/ProfilePage';
import VirtualTryOnPage from './pages/VirtualTryOnPage';
import SharedWishlistPage from './pages/SharedWishlistPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="admin/login" element={<AdminLoginPage />} />

        {/* Protected Routes (Login-First Enforcement) */}
        <Route element={<ProtectedRoute />}>
          <Route index element={<HomePage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="shared-wishlist/:shareId" element={<SharedWishlistPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<PurchasesPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="orders" element={<PurchasesPage />} />
          <Route path="orders/:id" element={<PurchasesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="virtual-try-on" element={<VirtualTryOnPage />} />
        </Route>

        {/* Protected Admin Routes (ADMIN Role strictly required) */}
        <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
        </Route>

        {/* Fallback Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
