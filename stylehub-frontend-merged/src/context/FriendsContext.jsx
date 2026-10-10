import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchFriendsApi,
  fetchFriendRequestsApi,
  searchUsersApi,
  sendFriendRequestApi,
  acceptFriendRequestApi,
  rejectFriendRequestApi,
  removeFriendApi
} from '../services/friendsService';
import {
  fetchNotificationsApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi
} from '../services/notificationService';

const FriendsContext = createContext(null);

export function FriendsProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all friends and requests
  const loadFriendsData = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [friendsRes, requestsRes] = await Promise.all([
        fetchFriendsApi(token),
        fetchFriendRequestsApi(token)
      ]);
      const rawFriends = Array.isArray(friendsRes)
        ? friendsRes
        : (Array.isArray(friendsRes?.friends) ? friendsRes.friends : []);
      const safeFriends = rawFriends.map(f => ({
        ...f,
        id: f.userId || f.id,
        userId: f.userId || f.id,
        friendshipId: f.friendshipId || f.id
      }));
      const safeIncoming = Array.isArray(requestsRes?.incoming)
        ? requestsRes.incoming
        : (Array.isArray(requestsRes?.data?.incoming) ? requestsRes.data.incoming : []);
      const safeOutgoing = Array.isArray(requestsRes?.outgoing)
        ? requestsRes.outgoing
        : (Array.isArray(requestsRes?.data?.outgoing) ? requestsRes.data.outgoing : []);

      setFriends(safeFriends);
      setIncomingRequests(safeIncoming);
      setOutgoingRequests(safeOutgoing);
    } catch (err) {
      console.error('Failed to load friends data:', err);
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setNotifications([]);
      setUnreadNotificationsCount(0);
      return;
    }
    try {
      const res = await fetchNotificationsApi(token);
      setNotifications(res.data?.notifications || (Array.isArray(res.data) ? res.data : []));
      setUnreadNotificationsCount(res.data?.unreadCount ?? (res.unreadCount || 0));
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadFriendsData();
      loadNotifications();

      // Poll notifications every 30 seconds for friend and share activity
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
    }
  }, [isAuthenticated, token, loadFriendsData, loadNotifications]);

  // Search users by username
  const searchUsers = useCallback(async (query) => {
    if (!token || !query || !query.trim()) return [];
    try {
      const res = await searchUsersApi(token, query.trim());
      return Array.isArray(res) ? res : (Array.isArray(res?.users) ? res.users : (res?.data?.users || []));
    } catch (err) {
      console.error('Search users error:', err);
      return [];
    }
  }, [token]);

  // Send friend request
  const sendRequest = async (receiverId) => {
    if (!token) throw new Error('Not authenticated');
    const res = await sendFriendRequestApi(token, receiverId);
    await loadFriendsData();
    return res;
  };

  // Accept friend request
  const acceptRequest = async (friendshipId) => {
    if (!token) throw new Error('Not authenticated');
    const res = await acceptFriendRequestApi(token, friendshipId);
    await loadFriendsData();
    return res;
  };

  // Reject friend request
  const rejectRequest = async (friendshipId) => {
    if (!token) throw new Error('Not authenticated');
    const res = await rejectFriendRequestApi(token, friendshipId);
    await loadFriendsData();
    return res;
  };

  // Remove friend
  const removeFriend = async (friendId) => {
    if (!token) throw new Error('Not authenticated');
    const res = await removeFriendApi(token, friendId);
    await loadFriendsData();
    return res;
  };

  // Mark notification read
  const markAsRead = async (id) => {
    if (!token) return;
    try {
      await markNotificationAsReadApi(token, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Mark all notifications read
  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await markAllNotificationsAsReadApi(token);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  return (
    <FriendsContext.Provider value={{
      friends,
      incomingRequests,
      outgoingRequests,
      notifications,
      unreadNotificationsCount,
      loading,
      error,
      refreshFriends: loadFriendsData,
      refreshNotifications: loadNotifications,
      searchUsers,
      sendRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
      markAsRead,
      markAllAsRead
    }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
}
