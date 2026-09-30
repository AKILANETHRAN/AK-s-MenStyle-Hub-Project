import { API_BASE_URL } from './api';

export async function fetchFriendsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/friends`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch friends');
  }
  return data.data?.friends || (Array.isArray(data.data) ? data.data : []);
}

export async function searchUsersApi(token, query) {
  const response = await fetch(`${API_BASE_URL}/api/friends/search?username=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to search users');
  }
  return data.data?.users || (Array.isArray(data.data) ? data.data : []);
}

export async function fetchFriendRequestsApi(token) {
  const response = await fetch(`${API_BASE_URL}/api/friends/requests`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch friend requests');
  }
  return data.data || data;
}

export async function sendFriendRequestApi(token, receiverId) {
  const payload = typeof receiverId === 'object' ? receiverId : { receiverId };
  const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send friend request');
  }
  return data;
}

export async function acceptFriendRequestApi(token, friendshipId) {
  const response = await fetch(`${API_BASE_URL}/api/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to accept friend request');
  }
  return data;
}

export async function rejectFriendRequestApi(token, friendshipId) {
  const response = await fetch(`${API_BASE_URL}/api/friends/${friendshipId}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to reject friend request');
  }
  return data;
}

export async function removeFriendApi(token, friendId) {
  const response = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to remove friend');
  }
  return data;
}
