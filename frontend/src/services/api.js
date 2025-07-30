import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          toast.error(data.message || 'Bad request');
          break;
        case 401:
          toast.error('Unauthorized access');
          // Clear auth token on 401
          localStorage.removeItem('authToken');
          break;
        case 403:
          toast.error('Access forbidden');
          break;
        case 404:
          toast.error('Resource not found');
          break;
        case 429:
          toast.error('Too many requests. Please slow down.');
          break;
        case 500:
          toast.error('Internal server error');
          break;
        default:
          toast.error(data.message || 'An error occurred');
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      // Other error
      toast.error('An unexpected error occurred');
    }
    
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// API endpoints
export const orderApi = {
  // Get user orders
  getUserOrders: (userAddress, params = {}) => 
    api.get(`/api/orders/${userAddress}`, { params }),
  
  // Submit new order
  submitOrder: (orderData) => 
    api.post('/api/orders', orderData),
  
  // Get specific order
  getOrder: (orderId) => 
    api.get(`/api/orders/order/${orderId}`),
  
  // Cancel order
  cancelOrder: (orderId, signature) => 
    api.put(`/api/orders/${orderId}/cancel`, { signature }),
};

export const orderbookApi = {
  // Get order book for token pair
  getOrderbook: (tokenPair) => 
    api.get(`/api/orderbook/${tokenPair}`),
  
  // Get available trading pairs
  getTradingPairs: () => 
    api.get('/api/orderbook/pairs'),
  
  // Get trade history for pair
  getPairHistory: (tokenPair, params = {}) => 
    api.get(`/api/orderbook/${tokenPair}/history`, { params }),
};

export const tradeApi = {
  // Get user trade history
  getUserTrades: (userAddress, params = {}) => 
    api.get(`/api/trades/${userAddress}`, { params }),
  
  // Get pair trade history
  getPairTrades: (tokenPair, params = {}) => 
    api.get(`/api/trades/pair/${tokenPair}`, { params }),
  
  // Get user trading statistics
  getUserStats: (userAddress) => 
    api.get(`/api/trades/stats/${userAddress}`),
  
  // Get specific match details
  getMatch: (matchId) => 
    api.get(`/api/trades/match/${matchId}`),
};

export const healthApi = {
  // Basic health check
  getHealth: () => 
    api.get('/api/health'),
  
  // Detailed system status
  getDetailedHealth: () => 
    api.get('/api/health/detailed'),
};

// Helper functions
export const apiHelpers = {
  // Format order data for submission
  formatOrderForSubmission: (order, signature) => ({
    userAddress: order.userAddress,
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    sellAmount: order.sellAmount.toString(),
    buyAmount: order.buyAmount.toString(),
    sourceChain: order.sourceChain,
    targetChain: order.targetChain,
    expiry: order.expiry,
    nonce: order.nonce,
    signature: signature,
  }),
  
  // Parse API errors
  parseApiError: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unknown error occurred';
  },
  
  // Format token pair for API calls
  formatTokenPair: (sellToken, buyToken) => `${sellToken}-${buyToken}`,
  
  // Parse token pair from API format
  parseTokenPair: (pairString) => {
    const [sellToken, buyToken] = pairString.split('-');
    return { sellToken, buyToken };
  },
};

export default api; 