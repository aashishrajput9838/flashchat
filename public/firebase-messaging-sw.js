// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

// Firebase configuration - make sure this matches your Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyB_3xErgKerW8IsWLQzu6IsMyiXNOPSxEo",
  authDomain: "web-socket-2e05f.firebaseapp.com",
  projectId: "web-socket-2e05f",
  storageBucket: "web-socket-2e05f.firebasestorage.app",
  messagingSenderId: "213332457740",
  appId: "1:213332457740:web:dbfe9e380e1629d0427129",
  measurementId: "G-RYFQE7TFGN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Extract notification data
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {}
  };
  
  // Set additional options based on notification type
  if (payload.data) {
    // Set priority
    if (payload.data.priority === 'high') {
      notificationOptions.vibrate = [200, 100, 200];
    }
    
    // Add tag for grouping notifications
    if (payload.data.type) {
      notificationOptions.tag = payload.data.type;
    }
    
    // Set require interaction for important notifications
    if (payload.data.priority === 'high' || 
        payload.data.type === 'call' || 
        payload.data.type === 'direct_message') {
      notificationOptions.requireInteraction = true;
    }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();
  
  // This looks for a URL in the data payload or defaults to the root
  const urlToOpen = event.notification.data?.url || '/';
  
  // This looks for an existing window with the URL
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If not, then open the target URL in a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push event for additional customization
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
      console.log('Push data:', notificationData);
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationData = {
        title: 'New Notification',
        body: event.data.text()
      };
    }
  }
  
  const title = notificationData.notification?.title || notificationData.title || 'New Notification';
  const options = {
    body: notificationData.notification?.body || notificationData.body || '',
    icon: notificationData.notification?.icon || notificationData.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: notificationData.data || {}
  };
  
  // Apply additional options based on notification data
  if (notificationData.data) {
    if (notificationData.data.priority === 'high') {
      options.vibrate = [200, 100, 200];
    }
    
    if (notificationData.data.tag) {
      options.tag = notificationData.data.tag;
    }
    
    if (notificationData.data.requireInteraction) {
      options.requireInteraction = true;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});