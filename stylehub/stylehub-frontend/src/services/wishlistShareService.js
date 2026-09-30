import { API_BASE_URL } from './api';

export async function createWishlistShareApi(token, { receiverId, productIds, shareType = 'PRODUCTS' }) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/shares`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ receiverId, productIds, shareType })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to share wishlist items');
  }
  return data;
}

export async function fetchWishlistSharesApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/shares`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch shared wishlists');
  }
  return data;
}

export async function fetchWishlistShareByIdApi(token, shareId) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/shares/${shareId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch shared look details');
  }
  return data.data;
}

export async function addShareFeedbackApi(token, shareId, { reaction, comment }) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist/shares/${shareId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reaction, comment })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to submit opinion');
  }
  return data;
}
