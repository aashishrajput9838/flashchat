import { messaging } from '@/config/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from '@/config/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getCurrentUser } from '@/features/user/services/userService';

// VAPID key for Firebase Cloud Messaging
const VAPID_KEY = 'ILEGD9BbwyPfiarYMDq9-OsJVZdu1l08AE8I13pp15c';

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
      await setDoc(userDocRef, { 
        fcmToken: token,
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
      }, { merge: true });
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
      const backendUrl = 'https://flashchat-production.up.railway.app'; // Updated with your Railway URL
      
      // Send notification to backend to trigger FCM
      const response = await fetch(`${backendUrl}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      
      const result = await response.json();
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
    }
    
    // Initialize foreground message handling
    initializeForegroundNotifications();
  } catch (error) {
    console.error('Error initializing notification service:', error);
  }
};