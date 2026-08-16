import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT Token & handle FormData headers
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dinebuddy_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 & 403
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('dinebuddy_token');
      localStorage.removeItem('dinebuddy_user');
    }
    return Promise.reject(error);
  }
);

// Real Database State (Starts completely empty when database tables are empty)
export const DEMO_DATA = {
  restaurants: [],
  ingredients: [],
  transactions: [],
  menuItems: [],
  recipes: [],
  tables: [],
  orders: [],
};

export const api = client;

/**
 * Helper to construct full media URL for logos and uploads.
 * If url is relative (e.g. /static/logos/abc.jpg), prepends the backend origin.
 */
export const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

