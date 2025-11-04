import { messaging } from '@/config/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from '@/config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getCurrentUser } from '@/features/user/services/userService';

// VAPID key for Firebase Cloud Messaging
const VAPID_KEY = 'ILEGD9BbwyPfiarYMDq9-OsJVZdu1l08AE8I13pp15c';

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if permission denied
 */
export const requestNotificationPermission = async () => {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return null;
    }

    // Check if messaging is initialized
    if (!messaging) {
      console.warn('Firebase Messaging not initialized');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    // Save token to user's document in Firestore
    const user = getCurrentUser();
    if (user && token) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { fcmToken: token }, { merge: true });
      console.log('FCM token saved to user document');
    }

    return token;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};

/**
 * Initialize foreground message handling
 */
export const initializeForegroundNotifications = () => {
  // Check if messaging is initialized
  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return;
  }

  // Handle foreground messages
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    
    // Show in-app notification using Web Notifications API
    showInAppNotification(payload);
  });
};

/**
 * Show in-app notification using Web Notifications API
 * @param {Object} payload - FCM message payload
 */
const showInAppNotification = (payload) => {
  try {
    // Extract notification data
    const title = payload.notification?.title || 'New Message';
    const body = payload.notification?.body || '';
    const icon = payload.notification?.icon || '/icon-192x192.png';
    
    // Create notification
    new Notification(title, {
      body: body,
      icon: icon,
      badge: '/icon-192x192.png'
    });
  } catch (error) {
    console.error('Error showing in-app notification:', error);
  }
};

/**
 * Send a message notification to a user
 * @param {string} recipientUserId - Firebase UID of the recipient
 * @param {string} senderName - Name of the sender
 * @param {string} messageText - Text of the message
 */
export const sendMessageNotification = async (recipientUserId, senderName, messageText) => {
  try {
    // Get the recipient's FCM token from Firestore
    const recipientDoc = await getDoc(doc(db, 'users', recipientUserId));
    const recipientFcmToken = recipientDoc.data()?.fcmToken;
    
    // Only send notification if recipient has a token
    if (recipientFcmToken) {
      // Truncate message for notification preview
      const previewText = messageText.length > 50 
        ? messageText.substring(0, 50) + '...' 
        : messageText;
      
      // Use Railway-deployed backend URL for sending notifications
      // TODO: Update with your actual Railway URL after deployment
      const backendUrl = 'https://your-app-name.up.railway.app'; // Update this with your Railway URL
      
      // Send notification to backend to trigger FCM
      const response = await fetch(`${backendUrl}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: recipientFcmToken,
          title: senderName,
          body: previewText,
          icon: '/icon-192x192.png'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('Notification sent successfully');
      } else {
        console.error('Failed to send notification:', result.error);
      }
    } else {
      console.log('Recipient does not have an FCM token');
    }
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
};

/**
 * Initialize notification service
 */
export const initNotificationService = async () => {
  try {
    // Request notification permission
    const token = await requestNotificationPermission();
    if (token) {
      console.log('Notification permission granted and token obtained');
    }
    
    // Initialize foreground message handling
    initializeForegroundNotifications();
  } catch (error) {
    console.error('Error initializing notification service:', error);
  }
};