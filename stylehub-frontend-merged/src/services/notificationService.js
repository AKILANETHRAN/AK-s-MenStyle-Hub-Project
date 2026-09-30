import { API_BASE_URL } from './api';

export async function fetchNotificationsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch notifications');
  }
  return data;
}

export async function markNotificationAsReadApi(token, id) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update notification');
  }
  return data;
}

export async function markAllNotificationsAsReadApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to clear notifications');
  }
  return data;
}
