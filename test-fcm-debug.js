// FCM Debug Test Script
// This script helps diagnose Firebase Cloud Messaging issues

console.log('=== FCM Debug Test ===');

// Check if required APIs are available
console.log('Checking browser support...');
console.log('- Notification API:', 'Notification' in window ? 'Available' : 'Not available');
console.log('- Service Worker API:', 'serviceWorker' in navigator ? 'Available' : 'Not available');
console.log('- Push Manager API:', 'PushManager' in window ? 'Available' : 'Not available');

// Check Firebase environment variables
console.log('\nChecking environment variables...');
const envVars = [
  'VITE_FCM_VAPID_KEY',
  'VITE_FIREBASE_VAPID_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID'
];

envVars.forEach(varName => {
  const value = import.meta.env[varName];
  if (value) {
    console.log(`- ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`- ${varName}: NOT SET`);
  }
});

// Check service worker status
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('\nService Worker Registrations:');
    if (registrations.length === 0) {
      console.log('- No service workers registered');
    } else {
      registrations.forEach(reg => {
        console.log(`- Scope: ${reg.scope}`);
        console.log(`  State: ${reg.installing ? 'installing' : reg.waiting ? 'waiting' : reg.active ? 'active' : 'unknown'}`);
      });
    }
  }).catch(error => {
    console.error('Error getting service worker registrations:', error);
  });
}

// Test notification permission
if ('Notification' in window) {
  console.log('\nNotification Permission Status:', Notification.permission);
  
  if (Notification.permission === 'default') {
    console.log('Requesting notification permission...');
    Notification.requestPermission().then(permission => {
      console.log('Notification permission result:', permission);
    }).catch(error => {
      console.error('Error requesting notification permission:', error);
    });
  }
}

console.log('\n=== End FCM Debug Test ===');
console.log('To run this test, import it in your main.jsx file or run it in the browser console.');