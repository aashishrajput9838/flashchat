import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Register service worker for Firebase Messaging with better error handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
        // Try to get more details about the error
        if (error.message) {
          console.log('Service Worker error details:', error.message);
        }
      });
  });
  
  // Add event listener for service worker updates
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Service Worker message received:', event.data);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);