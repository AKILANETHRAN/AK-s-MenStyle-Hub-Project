import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, registerApi, getMeApi, updateProfileApi, googleAuthApi } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'stylehub_auth_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from token on initial app mount
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMeApi(storedToken);
        setUser(userData);
        setToken(storedToken);
      } catch (err) {
        console.warn('Session restoration failed:', err.message);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await registerApi(userData);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = async (credentialOrCode) => {
    const data = await googleAuthApi(credentialOrCode);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const completeGoogleLogin = async (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    const userData = await getMeApi(newToken);
    setUser(userData);
    return { token: newToken, user: userData };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    if (!token) throw new Error('Not authenticated');
    const updated = await updateProfileApi(token, profileData);
    setUser(prev => ({ ...prev, ...updated }));
    return updated;
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    register,
    loginWithGoogle,
    completeGoogleLogin,
    logout,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
