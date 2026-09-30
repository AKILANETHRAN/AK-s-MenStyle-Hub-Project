import { API_BASE_URL } from './api';

export async function fetchCartApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch cart');
  }
  return data.data;
}

export async function addToCartApi(token, { productId, quantity = 1 }) {
  const response = await fetch(`${API_BASE_URL}/api/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productId, quantity })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to add item to cart');
  }
  return data.data;
}

export async function updateCartItemQuantityApi(token, productId, quantity) {
  const response = await fetch(`${API_BASE_URL}/api/cart/items/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ quantity })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update item quantity');
  }
  return data.data;
}

export async function removeCartItemApi(token, productId) {
  const response = await fetch(`${API_BASE_URL}/api/cart/items/${productId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to remove item from cart');
  }
  return data.data;
}

export async function clearCartApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to clear cart');
  }
  return data.data;
}
