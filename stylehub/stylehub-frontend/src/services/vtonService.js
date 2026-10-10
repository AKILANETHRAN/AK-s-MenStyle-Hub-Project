import { API_BASE_URL } from './api';

/**
 * Execute Virtual Try-On inference through Express backend bridge
 * @param {string} token - JWT bearer token
 * @param {number|string} productId - Product ID (must have vton_supported = 1)
 * @param {File} photoFile - User uploaded source photo (JPG, PNG, WebP)
 */
export async function executeTryOnApi(token, productId, photoFile) {
  if (!token) {
    throw new Error('Please sign in to use AI Virtual Try-On.');
  }

  const formData = new FormData();
  formData.append('productId', productId);
  formData.append('user_photo', photoFile);

  const response = await fetch(`${API_BASE_URL}/api/vton/try-on`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Virtual try-on could not be generated. Please try again.');
  }

  return data;
}

/**
 * Check health / status of VTON local service
 */
export async function fetchVtonStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vton/status`);
    if (!res.ok) return { available: false };
    return await res.json();
  } catch (err) {
    return { available: false };
  }
}

/**
 * Fetch user's try-on history
 */
export async function fetchVtonHistory(token) {
  if (!token) return [];
  const res = await fetch(`${API_BASE_URL}/api/vton/history`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}
