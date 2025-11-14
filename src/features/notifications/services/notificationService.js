import { messaging } from '@/config/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from '@/config/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getCurrentUser } from '@/features/user/services/userService';
import { validateVapidKey } from '@/utils/fcmDebug';

// VAPID key for Firebase Cloud Messaging - use the correct environment variable
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Add validation for VAPID key
if (!VAPID_KEY) {
  console.warn('FCM VAPID key not found in environment variables. Push notifications may not work.');
}

// Notification types and priorities
export const NOTIFICATION_TYPES = {
  DIRECT_MESSAGE: 'direct_message',
  MENTION: 'mention',
  GROUP_MESSAGE: 'group_message',
  CALL: 'call',
  SYSTEM: 'system'
};

export const NOTIFICATION_PRIORITY = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
};

// User notification preferences
const DEFAULT_NOTIFICATION_SETTINGS = {
  directMessages: true,
  mentions: true,
  groupMessages: true,
  calls: true,
  soundEnabled: true,
  vibrationEnabled: true,
  priority: NOTIFICATION_PRIORITY.HIGH
};

/**
 * Get user notification preferences
 * @param {string} userId - Firebase UID of the user
 * @returns {Promise<Object>} User notification settings
 */
export const getUserNotificationSettings = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    
    // Return user settings or default settings
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(userData?.notificationSettings || {})
    };
  } catch (error) {
    console.error('Error getting user notification settings:', error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

/**
 * Update user notification preferences
 * @param {string} userId - Firebase UID of the user
 * @param {Object} settings - New notification settings
 * @returns {Promise<void>}
 */
export const updateUserNotificationSettings = async (userId, settings) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      notificationSettings: settings
    });
    console.log('Notification settings updated successfully');
  } catch (error) {
    console.error('Error updating notification settings:', error);
  }
};

/**
 * Validate VAPID key format
 * @param {string} vapidKey - VAPID key to validate
 * @returns {boolean} Whether the key is valid
 */
const isValidVapidKey = (vapidKey) => {
  if (!vapidKey || typeof vapidKey !== 'string') {
    return false;
  }
  
  // Use our utility function for validation
  const validation = validateVapidKey(vapidKey);
  return validation.isValid;
};

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if permission denied
 */
export const requestNotificationPermission = async () => {
  try {
    console.log('Requesting notification permission...');
    
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
    console.log('Notification permission result:', permission);
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Validate VAPID key before attempting to get token
    if (!VAPID_KEY) {
      console.error('VAPID key is missing. Cannot get FCM token.');
      console.error('Please set VITE_FCM_VAPID_KEY in your .env file');
      return null;
    }

    // Validate VAPID key format
    const vapidValidation = validateVapidKey(VAPID_KEY);
    if (!vapidValidation.isValid) {
      console.error('VAPID key validation failed:', vapidValidation.message);
      return null;
    }

    // Get FCM token
    console.log('Getting FCM token with VAPID key:', VAPID_KEY ? VAPID_KEY.substring(0, 10) + '...' : 'undefined');
    
    // Add timeout to prevent hanging
    const tokenPromise = getToken(messaging, { vapidKey: VAPID_KEY });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('FCM token request timeout')), 10000)
    );
    
    const token = await Promise.race([tokenPromise, timeoutPromise]);
    console.log('FCM token obtained:', token ? token.substring(0, 20) + '...' : 'null');
    
    // Validate token format
    if (!token || typeof token !== 'string' || token.length < 100) {
      console.error('Invalid FCM token format:', token ? `Token length: ${token.length}` : 'null token');
      return null;
    }
    
    // Save the token globally so it can be accessed for testing
    window.fcmToken = token;
    console.log('FCM token saved to window.fcmToken for easy access');
    
    // Save token to user's document in Firestore
    const user = getCurrentUser();
    if (user && token) {
      console.log('Saving FCM token for user:', user.uid);
      
      // Update token via backend API
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      console.log('Sending FCM token to backend at:', backendUrl);
      
      try {
        const response = await fetch(`${backendUrl}/api/update-fcm-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.uid,
            fcmToken: token
          })
        });
        
        console.log('Backend response status:', response.status);
        console.log('Backend response headers:', [...response.headers.entries()]);
        
        if (response.ok) {
          const responseData = await response.json();
          console.log('FCM token sent to backend successfully:', responseData);
        } else {
          const errorText = await response.text();
          console.error('Failed to send FCM token to backend:', response.status, errorText);
        }
      } catch (backendError) {
        console.error('Error sending FCM token to backend:', backendError);
        // Fallback to direct Firestore update
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { 
          fcmToken: token,
          notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
        }, { merge: true });
      }
      
      // Also send token via socket connection if available
      if (window.socket) {
        window.socket.emit('update_fcm_token', {
          userId: user.uid,
          fcmToken: token
        });
        console.log('FCM token sent via socket');
      }
      
      console.log('FCM token saved to user document');
    }

    return token;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    // Provide more specific error messages
    if (error.code === 'messaging/invalid-app') {
      console.error('Firebase app is not properly initialized for messaging');
    } else if (error.code === 'messaging/failed-service-worker-registration') {
      console.error('Service worker registration failed. Check your firebase-messaging-sw.js file.');
    } else if (error.message.includes('applicationServerKey')) {
      console.error('VAPID key is invalid. Please check your Firebase project settings and ensure the key is correctly formatted.');
      console.error('Current VAPID key length:', VAPID_KEY ? VAPID_KEY.length : 0);
      // Validate the key again for more details
      if (VAPID_KEY) {
        const validation = validateVapidKey(VAPID_KEY);
        console.error('VAPID key validation details:', validation.message);
      }
    } else if (error.message.includes('timeout')) {
      console.error('FCM token request timed out. This may be due to network issues or Firebase service problems.');
    }
    return null;
  }
};

/**
 * Show in-app notification using Web Notifications API
 * @param {Object} payload - FCM message payload
 */
const showInAppNotification = (payload) => {
  try {
    console.log('Showing in-app notification:', payload);
    
    // Extract notification data
    const title = payload.notification?.title || 'New Message';
    const body = payload.notification?.body || '';
    const icon = payload.notification?.icon || '/icon-192x192.png';
    
    // Create notification with additional options
    const notificationOptions = {
      body: body,
      icon: icon,
      badge: '/icon-192x192.png',
      data: payload.data || {}
    };
    
    // Add additional options based on data
    if (payload.data) {
      if (payload.data.priority === 'high') {
        notificationOptions.vibrate = [200, 100, 200];
      }
      
      if (payload.data.tag) {
        notificationOptions.tag = payload.data.tag;
      }
      
      if (payload.data.requireInteraction) {
        notificationOptions.requireInteraction = true;
      }
    }
    
    // Create notification
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, notificationOptions);
      console.log('In-app notification created:', notification);
      
      // Handle notification click
      notification.onclick = function(event) {
        event.preventDefault();
        window.focus();
        notification.close();
      };
    } else {
      console.warn('Notification permission not granted for in-app notification');
    }
  } catch (error) {
    console.error('Error showing in-app notification:', error);
  }
};

/**
 * Initialize foreground message handling
 */
export const initializeForegroundNotifications = async () => {
  // Check if messaging is initialized
  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return;
  }

  // Handle foreground messages
  onMessage(messaging, async (payload) => {
    console.log('Message received in foreground:', payload);
    
    // Get current user to check notification settings
    const user = getCurrentUser();
    if (user) {
      // Get user notification settings
      const settings = await getUserNotificationSettings(user.uid);
      
      // Check if notification should be shown based on type
      const notificationType = payload.data?.type || 'direct_message';
      if (shouldSendNotification(settings, notificationType)) {
        // Show in-app notification using Web Notifications API
        showInAppNotification(payload);
      }
    } else {
      // If no user, show notification by default
      showInAppNotification(payload);
    }
  });
};

/**
 * Send a notification to a user
 * @param {string} recipientUserId - Firebase UID of the recipient
 * @param {Object} notificationData - Notification details
 * @param {string} notificationData.type - Type of notification
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.body - Notification body
 * @param {string} notificationData.icon - Notification icon
 * @param {string} notificationData.priority - Notification priority
 * @param {Object} notificationData.data - Additional data
 * @returns {Promise<boolean>} Success status
 */
export const sendNotification = async (recipientUserId, notificationData) => {
  try {
    // Get recipient's notification settings
    const settings = await getUserNotificationSettings(recipientUserId);
    
    // Check if user has enabled this type of notification
    if (!shouldSendNotification(settings, notificationData.type)) {
      console.log(`Notification type ${notificationData.type} disabled for user`);
      return false;
    }
    
    // Get the recipient's FCM token from Firestore
    const recipientDoc = await getDoc(doc(db, 'users', recipientUserId));
    const recipientFcmToken = recipientDoc.data()?.fcmToken;
    
    // Only send notification if recipient has a token
    if (recipientFcmToken) {
      // Use Railway-deployed backend URL for sending notifications
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      console.log('Sending notification to backend at:', backendUrl);
      
      // Send notification to backend to trigger FCM
      const response = await fetch(`${backendUrl}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Add authentication header if needed
        },
        body: JSON.stringify({
          token: recipientFcmToken,
          title: notificationData.title,
          body: notificationData.body,
          icon: notificationData.icon || '/icon-192x192.png',
          data: {
            ...notificationData.data,
            type: notificationData.type,
            priority: notificationData.priority
          }
        })
      });
      
      console.log('Notification response status:', response.status);
      
      const result = await response.json();
      console.log('Notification response data:', result);
      
      if (result.success) {
        console.log('Notification sent successfully');
        return true;
      } else {
        console.error('Failed to send notification:', result.error);
        // Try fallback mechanism
        return await sendFallbackNotification(recipientUserId, notificationData);
      }
    } else {
      console.log('Recipient does not have an FCM token');
      // Try fallback mechanism
      return await sendFallbackNotification(recipientUserId, notificationData);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    // Try fallback mechanism
    return await sendFallbackNotification(recipientUserId, notificationData);
  }
};

/**
 * Check if notification should be sent based on user settings
 * @param {Object} settings - User notification settings
 * @param {string} type - Notification type
 * @returns {boolean} Whether to send notification
 */
const shouldSendNotification = (settings, type) => {
  switch (type) {
    case NOTIFICATION_TYPES.DIRECT_MESSAGE:
      return settings.directMessages;
    case NOTIFICATION_TYPES.MENTION:
      return settings.mentions;
    case NOTIFICATION_TYPES.GROUP_MESSAGE:
      return settings.groupMessages;
    case NOTIFICATION_TYPES.CALL:
      return settings.calls;
    case NOTIFICATION_TYPES.SYSTEM:
      return true; // Always send system notifications
    default:
      return true;
  }
};

/**
 * Fallback mechanism for notifications
 * @param {string} recipientUserId - Firebase UID of the recipient
 * @param {Object} notificationData - Notification details
 * @returns {Promise<boolean>} Success status
 */
const sendFallbackNotification = async (recipientUserId, notificationData) => {
  try {
    console.log('Attempting fallback notification mechanism');
    
    // For now, we'll just log the fallback attempt
    // In a real implementation, you might:
    // 1. Send an email notification
    // 2. Send an SMS notification
    // 3. Queue the notification for later delivery
    
    // Example: Send email notification
    // await sendEmailNotification(recipientUserId, notificationData);
    
    // Example: Queue notification for later
    // await queueNotification(recipientUserId, notificationData);
    
    return false; // Return false as we haven't actually sent a fallback notification
  } catch (error) {
    console.error('Error in fallback notification mechanism:', error);
    return false;
  }
};

/**
 * Send a message notification to a user
 * @param {string} recipientUserId - Firebase UID of the recipient
 * @param {string} senderName - Name of the sender
 * @param {string} messageText - Text of the message
 * @param {string} messageType - Type of message (direct, group, etc.)
 * @returns {Promise<boolean>} Success status
 */
export const sendMessageNotification = async (recipientUserId, senderName, messageText, messageType = NOTIFICATION_TYPES.DIRECT_MESSAGE) => {
  try {
    // Truncate message for notification preview
    const previewText = messageText.length > 50 
      ? messageText.substring(0, 50) + '...' 
      : messageText;
    
    // Determine notification priority based on message type
    let priority = NOTIFICATION_PRIORITY.NORMAL;
    if (messageType === NOTIFICATION_TYPES.DIRECT_MESSAGE || 
        messageType === NOTIFICATION_TYPES.MENTION ||
        messageType === NOTIFICATION_TYPES.CALL) {
      priority = NOTIFICATION_PRIORITY.HIGH;
    }
    
    // Send notification
    return await sendNotification(recipientUserId, {
      type: messageType,
      title: senderName,
      body: previewText,
      icon: '/icon-192x192.png',
      priority: priority,
      data: {
        senderName: senderName,
        messageText: messageText
      }
    });
  } catch (error) {
    console.error('Error sending message notification:', error);
    return false;
  }
};

/**
 * Send a call notification to a user
 * @param {string} recipientUserId - Firebase UID of the recipient
 * @param {string} callerName - Name of the caller
 * @param {string} callType - Type of call (audio/video)
 * @returns {Promise<boolean>} Success status
 */
export const sendCallNotification = async (recipientUserId, callerName, callType) => {
  try {
    return await sendNotification(recipientUserId, {
      type: NOTIFICATION_TYPES.CALL,
      title: 'Incoming Call',
      body: `${callerName} is calling you (${callType})`,
      icon: '/icon-192x192.png',
      priority: NOTIFICATION_PRIORITY.HIGH,
      data: {
        callerName: callerName,
        callType: callType
      }
    });
  } catch (error) {
    console.error('Error sending call notification:', error);
    return false;
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
    } else {
      console.log('Notification permission not granted or token could not be obtained');
    }
    
    // Initialize foreground message handling
    await initializeForegroundNotifications();
    
    // Add a helper function to the window object for easy testing
    window.getFcmToken = async () => {
      console.log('Getting FCM token...');
      const newToken = await requestNotificationPermission();
      if (newToken) {
        window.fcmToken = newToken;
        console.log('New FCM token:', newToken ? newToken.substring(0, 20) + '...' : 'null');
        console.log('You can now test notifications with this token!');
        return newToken;
      }
      return null;
    };
    
    console.log('Notification service initialized. Use window.getFcmToken() to get a new token or window.fcmToken to access the current token.');
  } catch (error) {
    console.error('Error initializing notification service:', error);
  }
};