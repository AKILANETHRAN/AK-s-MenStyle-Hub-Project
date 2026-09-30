import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchWishlistApi,
  toggleWishlistApi,
  removeWishlistItemApi,
  clearWishlistApi
} from '../services/wishlistService';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState({ items: [], totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setWishlist({ items: [], totalItems: 0 });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWishlistApi(token);
      setWishlist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const isInWishlist = (productId) => {
    const pId = parseInt(productId, 10);
    return wishlist.items.some((item) => item.productId === pId);
  };

  const toggleWishlist = async (productId) => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const result = await toggleWishlistApi(token, { productId, action: 'toggle' });
      setWishlist({
        items: result.items,
        totalItems: result.totalItems
      });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedWishlist = await removeWishlistItemApi(token, productId);
      setWishlist(updatedWishlist);
      return updatedWishlist;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const clearWishlist = async () => {
    if (!token) throw new Error('Authentication required.');
    setError(null);
    try {
      const updatedWishlist = await clearWishlistApi(token);
      setWishlist(updatedWishlist);
      return updatedWishlist;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        loading,
        error,
        loadWishlist,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
