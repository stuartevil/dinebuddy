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

  const [savedAccounts, setSavedAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem('dinebuddy_saved_accounts');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
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

  const saveAccountToMultiSession = (userObj) => {
    setSavedAccounts(prev => {
      const filtered = prev.filter(acc => acc.email !== userObj.email);
      const updated = [userObj, ...filtered];
      localStorage.setItem('dinebuddy_saved_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/restaurants/');
      // Backend returns: { status: bool, message: str, data: [...], meta: {...} }
      const list = res.data?.data || [];
      setRestaurants(list);
      if (list.length > 0) {
        setSelectedRestaurantId(prev => {
          const exists = list.some(r => r.id === prev);
          return exists ? prev : list[0].id;
        });
      } else {
        setSelectedRestaurantId(null);
      }
      return list;
    } catch (err) {
      console.warn('Backend /restaurants/ fetch failed:', err.message);
      setRestaurants([]);
      setSelectedRestaurantId(null);
      return [];
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

      const fullName = userData.full_name || userData.email || 'User';
      const userObj = {
        id: userData.id,
        email: userData.email,
        role: resolvedRole,
        name: fullName,
        avatar: fullName ? fullName.charAt(0).toUpperCase() : 'U',
        token,
      };

      // Fetch fresh restaurants from DB before updating user state
      await fetchRestaurants();

      setCurrentUser(userObj);
      localStorage.setItem('dinebuddy_user', JSON.stringify(userObj));
      saveAccountToMultiSession(userObj);

      addToast('success', 'Backend Authenticated', `Welcome back ${userData.full_name}!`);
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Login failed';
      console.error('Login failed:', detail);
      addToast('error', 'Login Failed', detail);
      throw err;
    }
  };

  const switchAccount = async (targetEmail) => {
    const target = savedAccounts.find(acc => acc.email === targetEmail);
    if (!target) return;

    localStorage.setItem('dinebuddy_token', target.token);
    localStorage.setItem('dinebuddy_user', JSON.stringify(target));
    setCurrentUser(target);

    try {
      await fetchRestaurants();
      addToast('info', 'Session Switched', `Active user changed to ${target.name} (${target.email})`);
    } catch (err) {
      console.warn('Error switching account session:', err.message);
    }
  };

  const removeSavedAccount = (targetEmail) => {
    setSavedAccounts(prev => {
      const updated = prev.filter(acc => acc.email !== targetEmail);
      localStorage.setItem('dinebuddy_saved_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    if (currentUser) {
      removeSavedAccount(currentUser.email);
    }
    setCurrentUser(null);
    setRestaurants([]);
    setSelectedRestaurantId(null);
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
    savedAccounts,
    switchAccount,
    removeSavedAccount,
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
