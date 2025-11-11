// FCM Debug Utility
// Utility functions to help debug Firebase Cloud Messaging issues

/**
 * Validate VAPID key format
 * @param {string} vapidKey - VAPID key to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validateVapidKey = (vapidKey) => {
  if (!vapidKey) {
    return {
      isValid: false,
      message: 'VAPID key is missing'
    };
  }
  
  if (typeof vapidKey !== 'string') {
    return {
      isValid: false,
      message: 'VAPID key must be a string'
    };
  }
  
  if (vapidKey.length < 64) {
    return {
      isValid: false,
      message: 'VAPID key is too short (minimum 64 characters)'
    };
  }
  
  // Check if it looks like a base64 string (including URL-safe base64)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  const urlSafeBase64Regex = /^[A-Za-z0-9_-]*={0,2}$/;
  if (!base64Regex.test(vapidKey) && !urlSafeBase64Regex.test(vapidKey)) {
    return {
      isValid: false,
      message: 'VAPID key does not appear to be a valid base64 string'
    };
  }
  
  return {
    isValid: true,
    message: 'VAPID key format is valid'
  };
};

/**
 * Check service worker registration
 * @returns {Promise<Object>} Registration status
 */
export const checkServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return {
      registered: false,
      message: 'Service Worker API not available in this browser'
    };
  }
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return {
        registered: false,
        message: 'No service workers registered'
      };
    }
    
    const firebaseSw = registrations.find(reg => 
      reg.scope.includes('firebase') || 
      reg.active?.scriptURL?.includes('firebase-messaging-sw')
    );
    
    if (firebaseSw) {
      return {
        registered: true,
        message: 'Firebase Messaging service worker is registered',
        scope: firebaseSw.scope,
        state: firebaseSw.installing ? 'installing' : 
               firebaseSw.waiting ? 'waiting' : 
               firebaseSw.active ? 'active' : 'unknown'
      };
    } else {
      return {
        registered: false,
        message: 'Firebase Messaging service worker not found',
        registrations: registrations.map(reg => ({
          scope: reg.scope,
          scriptURL: reg.active?.scriptURL
        }))
      };
    }
  } catch (error) {
    return {
      registered: false,
      message: `Error checking service worker: ${error.message}`
    };
  }
};

/**
 * Check notification permissions
 * @returns {Object} Permission status
 */
export const checkNotificationPermission = () => {
  if (!('Notification' in window)) {
    return {
      supported: false,
      message: 'Notification API not supported in this browser'
    };
  }
  
  return {
    supported: true,
    permission: Notification.permission,
    message: `Notification permission is ${Notification.permission}`
  };
};

/**
 * Comprehensive FCM debug check
 * @returns {Promise<Object>} Debug results
 */
export const debugFcmSetup = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    vapidKey: {},
    serviceWorker: {},
    notificationPermission: {},
    environment: {}
  };
  
  // Check VAPID key
  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;
  results.vapidKey = validateVapidKey(vapidKey);
  results.vapidKey.value = vapidKey ? `${vapidKey.substring(0, 10)}...` : null;
  
  // Check service worker
  results.serviceWorker = await checkServiceWorker();
  
  // Check notification permission
  results.notificationPermission = checkNotificationPermission();
  
  // Check environment
  results.environment = {
    browserSupport: {
      notification: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window
    },
    firebaseEnvVars: {
      VITE_FCM_VAPID_KEY: !!import.meta.env.VITE_FCM_VAPID_KEY,
      VITE_FIREBASE_VAPID_KEY: !!import.meta.env.VITE_FIREBASE_VAPID_KEY,
      VITE_FIREBASE_API_KEY: !!import.meta.env.VITE_FIREBASE_API_KEY,
      VITE_FIREBASE_PROJECT_ID: !!import.meta.env.VITE_FIREBASE_PROJECT_ID
    }
  };
  
  return results;
};

/**
 * Print debug results in a formatted way
 * @param {Object} results - Debug results from debugFcmSetup
 */
export const printDebugResults = (results) => {
  console.log('=== FCM Debug Results ===');
  console.log(`Timestamp: ${results.timestamp}`);
  
  console.log('\n--- VAPID Key ---');
  console.log(`Valid: ${results.vapidKey.isValid}`);
  console.log(`Message: ${results.vapidKey.message}`);
  console.log(`Value: ${results.vapidKey.value}`);
  
  console.log('\n--- Service Worker ---');
  console.log(`Registered: ${results.serviceWorker.registered}`);
  console.log(`Message: ${results.serviceWorker.message}`);
  if (results.serviceWorker.scope) {
    console.log(`Scope: ${results.serviceWorker.scope}`);
  }
  if (results.serviceWorker.state) {
    console.log(`State: ${results.serviceWorker.state}`);
  }
  
  console.log('\n--- Notification Permission ---');
  console.log(`Supported: ${results.notificationPermission.supported}`);
  console.log(`Permission: ${results.notificationPermission.permission}`);
  console.log(`Message: ${results.notificationPermission.message}`);
  
  console.log('\n--- Environment ---');
  console.log('Browser Support:');
  Object.entries(results.environment.browserSupport).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? '✓' : '✗'}`);
  });
  
  console.log('Environment Variables:');
  Object.entries(results.environment.firebaseEnvVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? 'SET' : 'NOT SET'}`);
  });
  
  console.log('\n=== End Debug Results ===');
};

// Export a simple function to run the full debug
export const runFcmDebug = async () => {
  const results = await debugFcmSetup();
  printDebugResults(results);
  return results;
};

export default {
  validateVapidKey,
  checkServiceWorker,
  checkNotificationPermission,
  debugFcmSetup,
  printDebugResults,
  runFcmDebug
};