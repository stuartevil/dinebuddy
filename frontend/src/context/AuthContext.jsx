import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/apiClient';

const AuthContext = createContext();

export const ROLES = {
  SUPERADMIN: 'ADMIN',
  RESTAURANT_ADMIN: 'RESTAURANT_ADMIN',
  RESTAURANT_STAFF: 'RESTAURANT_STAFF',
  CUSTOMER: 'CUSTOMER',
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('dinebuddy_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [toasts, setToasts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Fetch real restaurants from backend API whenever logged in
  useEffect(() => {
    if (currentUser) {
      fetchRestaurants();
    }
  }, [currentUser]);

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/restaurants/');
      // Backend returns: { status: bool, message: str, data: [...], meta: {...} }
      const list = res.data?.data || [];
      setRestaurants(list);
      if (list.length > 0 && !selectedRestaurantId) {
        setSelectedRestaurantId(list[0].id);
      }
    } catch (err) {
      console.warn('Backend /restaurants/ fetch failed:', err.message);
      setRestaurants([]);
    }
  };

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId) || restaurants[0] || null;

  const addToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const requestConfirm = ({ title, message, confirmText = 'Confirm', onConfirm }) => {
    setConfirmConfig({ title, message, confirmText, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmConfig(null);
  };

  // Real Backend API Login Integration
  const login = async (emailInput, passwordInput) => {
    const email = emailInput ? emailInput.trim() : '';
    const password = passwordInput ? passwordInput.trim() : '';

    try {
      // 1. Attempt API authentication with backend FastAPI server
      const res = await api.post('/auth/login', { email, password });
      const token = res.data.access_token;
      localStorage.setItem('dinebuddy_token', token);

      // 2. Fetch authenticated profile from GET /users/me
      const meRes = await api.get('/users/me');
      const userData = meRes.data;

      // Normalize role casing to match ROLES enum
      let resolvedRole = (userData.role || 'RESTAURANT_ADMIN').toUpperCase();
      if (resolvedRole === 'ADMIN') resolvedRole = ROLES.SUPERADMIN;

      const userObj = {
        id: userData.id,
        email: userData.email,
        role: resolvedRole,
        name: userData.full_name,
        avatar: userData.full_name ? userData.full_name[0].toUpperCase() : 'U',
        token,
      };

      setCurrentUser(userObj);
      localStorage.setItem('dinebuddy_user', JSON.stringify(userObj));
      addToast('success', 'Backend Authenticated', `Welcome back ${userData.full_name}!`);
      
      // Fetch fresh restaurants from DB
      fetchRestaurants();
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Login failed';
      console.error('Login failed:', detail);
      addToast('error', 'Login Failed', detail);
      throw err;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('dinebuddy_user');
    localStorage.removeItem('dinebuddy_token');
    addToast('info', 'Logged Out', 'You have been safely signed out.');
  };

  const switchRestaurant = (id) => {
    if (currentUser && currentUser.role !== ROLES.SUPERADMIN) {
      addToast('error', 'Access Denied', 'Multi-tenant isolation: You can only access your assigned restaurant.');
      return;
    }
    setSelectedRestaurantId(id);
    addToast('info', 'Restaurant Switched', `Active restaurant changed to ID #${id}`);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const canAccessReports = currentUser && (currentUser.role === ROLES.SUPERADMIN || currentUser.role === ROLES.RESTAURANT_ADMIN);
  const canAccessInventory = currentUser && (currentUser.role === ROLES.SUPERADMIN || currentUser.role === ROLES.RESTAURANT_ADMIN);
  const canAccessFinancials = currentUser && (currentUser.role === ROLES.SUPERADMIN || currentUser.role === ROLES.RESTAURANT_ADMIN);
  const isSuperadmin = currentUser && currentUser.role === ROLES.SUPERADMIN;

  const value = {
    currentUser,
    login,
    logout,
    activeRole: currentUser ? currentUser.role : null,
    restaurants,
    setRestaurants,
    selectedRestaurant,
    switchRestaurant,
    fetchRestaurants,
    theme,
    toggleTheme,
    ROLES,
    canAccessReports,
    canAccessInventory,
    canAccessFinancials,
    isSuperadmin,
    toasts,
    addToast,
    removeToast,
    confirmConfig,
    requestConfirm,
    closeConfirm,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
