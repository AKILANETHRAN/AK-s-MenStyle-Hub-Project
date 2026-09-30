import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchCartApi,
  addToCartApi,
  updateCartItemQuantityApi,
  removeCartItemApi,
  clearCartApi
} from '../services/cartService';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [cart, setCart] = useState({ items: [], totalItems: 0, subtotal: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCart = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setCart({ items: [], totalItems: 0, subtotal: 0 });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCartApi(token);
      setCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = async (productId, quantity = 1) => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedCart = await addToCartApi(token, { productId, quantity });
      setCart(updatedCart);
      return updatedCart;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedCart = await updateCartItemQuantityApi(token, productId, quantity);
      setCart(updatedCart);
      return updatedCart;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeItem = async (productId) => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedCart = await removeCartItemApi(token, productId);
      setCart(updatedCart);
      return updatedCart;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const clearCart = async () => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedCart = await clearCartApi(token);
      setCart(updatedCart);
      return updatedCart;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const hasOutOfStockItems = cart.items.some(
    (item) => item.isOutOfStock || item.stock === 0 || item.insufficientStock
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        loadCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        hasOutOfStockItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
