import { io } from "socket.io-client";

// Initialize socket connection based on environment
// For production, we need to determine the correct server URL
const getSocketURL = () => {
  if (typeof window !== 'undefined') {
    // If we're on the production domain, use the same domain for socket
    if (window.location.hostname === 'flashchat-coral.vercel.app') {
      return 'https://flashchat-coral.vercel.app';
    }
    // For local development, use localhost
    return 'http://localhost:3001';
  }
  // Default for server-side rendering
  return 'http://localhost:3001';
};

const socket = io(getSocketURL(), {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});

// This file is no longer needed as we're using Firestore for real-time messaging
// Keeping it for now to avoid breaking imports, but it's not used
export default null;
