import { API_BASE_URL } from './api';

export async function fetchWishlistApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch wishlist');
  }
  return data.data;
}

export async function toggleWishlistApi(token, { productId, action = 'toggle' }) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productId, action })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update wishlist');
  }
  return data.data;
}

export async function removeWishlistItemApi(token, productId) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/items/${productId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to remove item from wishlist');
  }
  return data.data;
}

export async function clearWishlistApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to clear wishlist');
  }
  return data.data;
}
