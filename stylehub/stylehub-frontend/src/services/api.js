export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function registerApi(userData) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed');
  }
  return data;
}

export async function loginApi(credentials) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Invalid email or password');
  }
  return data;
}

export async function getMeApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to authenticate session');
  }
  return data;
}

export async function updateProfileApi(token, profileData) {
  const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update profile');
  }
  return data;
}

export async function fetchProductsApi(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE_URL}/api/products?${queryString}` : `${API_BASE_URL}/api/products`;

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch products');
  }
  return data;
}

export async function fetchProductByIdApi(id) {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Product not found');
  }
  return data;
}

// ==========================================
// Phase 8: Recommendations & Simple Purchase
// ==========================================

export async function fetchRecommendationsApi(productId) {
  const response = await fetch(`${API_BASE_URL}/api/recommendations/product/${productId}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch recommendations');
  }
  return data;
}

export async function purchaseProductApi(token, productId, quantity = 1) {
  const response = await fetch(`${API_BASE_URL}/api/purchases/product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productId, quantity })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to complete product purchase');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function purchaseComboApi(token, productIds) {
  const response = await fetch(`${API_BASE_URL}/api/purchases/combo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productIds })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to complete combo purchase');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function fetchPurchasesApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/purchases`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch purchase history');
  }
  return data;
}

export async function fetchPurchaseByIdApi(token, id) {
  const response = await fetch(`${API_BASE_URL}/api/purchases/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Purchase not found');
  }
  return data;
}

// ==========================================
// Phase 10: Recently Accessed API
// ==========================================

export async function fetchRecentlyAccessedApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/recently-accessed`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch recently accessed products');
  }
  return data;
}

export async function recordRecentlyAccessedApi(token, productId) {
  const response = await fetch(`${API_BASE_URL}/api/recently-accessed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ productId })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to record product access');
  }
  return data;
}

// ==========================================
// Phase 10: Admin Dashboard APIs
// ==========================================

export async function fetchAdminMetricsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin metrics');
  return data;
}

export async function fetchAdminProductsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin products');
  return data;
}

export async function updateAdminProductApi(token, id, updates) {
  const response = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update product');
  return data;
}

export async function fetchAdminUsersApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin users');
  return data;
}

export async function fetchAdminPurchasesApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/purchases`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin purchases');
  return data;
}

export async function fetchAdminVtonStatsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/vton-stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin VTON stats');
  return data;
}

export async function fetchAdminRecentActivityApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/recent-activity`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin recent activity');
  return data;
}

// ==========================================
// Phase 10: Chatbot Assistant API
// ==========================================

export async function sendChatbotMessageApi(message) {
  const response = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to get chatbot reply');
  return data;
}


