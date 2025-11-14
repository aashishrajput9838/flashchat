import { io } from 'socket.io-client';

// Socket connection service
let socket = null;

/**
 * Initialize socket connection
 * @param {string} userId - The current user's ID
 * @returns {Object} - The socket instance
 */
export const initSocket = (userId) => {
  if (!socket) {
    // Connect to the backend server with proper configuration
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      timeout: 10000, // 10 second timeout
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    
    // Register user with their UID when connected
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      if (userId) {
        socket.emit('register_user', userId);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    // Make socket available globally
    window.socket = socket;
  } else if (userId && socket.userId !== userId) {
    // Update user ID if it has changed
    updateUserId(userId);
  }
  
  return socket;
};

/**
 * Get the socket instance
 * @returns {Object|null} - The socket instance or null if not initialized
 */
export const getSocket = () => {
  return socket;
};

/**
 * Register user with socket server
 * @param {string} userId - The user's ID
 */
export const registerUser = (userId) => {
  if (socket && userId) {
    socket.emit('register_user', userId);
  }
};

/**
 * Update user registration with new user ID
 * @param {string} userId - The new user's ID
 */
export const updateUserId = (userId) => {
  if (socket && userId) {
    socket.userId = userId;
    socket.emit('register_user', userId);
  }
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    window.socket = null;
  }
};