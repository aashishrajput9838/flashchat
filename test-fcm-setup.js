// FCM Setup Verification Script
// Run this script to verify your FCM configuration

console.log('=== FCM Setup Verification ===');

// Check environment variables
console.log('\n1. Checking Environment Variables:');
const requiredEnvVars = ['VITE_FCM_VAPID_KEY'];
const optionalEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'];

requiredEnvVars.forEach(varName => {
  const value = import.meta.env[varName];
  if (value) {
    console.log(`   ✓ ${varName}: SET (length: ${value.length})`);
  } else {
    console.log(`   ✗ ${varName}: MISSING`);
  }
});

optionalEnvVars.forEach(varName => {
  const value = import.meta.env[varName];
  if (value) {
    console.log(`   ✓ ${varName}: SET`);
  } else {
    console.log(`   ○ ${varName}: Not set (optional)`);
  }
});

// Check browser APIs
console.log('\n2. Checking Browser APIs:');
const apis = [
  { name: 'Notification', available: 'Notification' in window },
  { name: 'Service Worker', available: 'serviceWorker' in navigator },
  { name: 'Push Manager', available: 'PushManager' in window }
];

apis.forEach(api => {
  console.log(`   ${api.available ? '✓' : '✗'} ${api.name}: ${api.available ? 'Available' : 'Not Available'}`);
});

// Check service worker
console.log('\n3. Checking Service Worker:');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    if (registrations.length > 0) {
      console.log('   ✓ Service workers registered:');
      registrations.forEach(reg => {
        console.log(`     - Scope: ${reg.scope}`);
        console.log(`       State: ${reg.installing ? 'installing' : reg.waiting ? 'waiting' : reg.active ? 'active' : 'unknown'}`);
      });
    } else {
      console.log('   ○ No service workers registered');
    }
  }).catch(error => {
    console.log('   ✗ Error checking service workers:', error.message);
  });
}

// Check notification permission
console.log('\n4. Checking Notification Permission:');
if ('Notification' in window) {
  console.log(`   Current permission status: ${Notification.permission}`);
  if (Notification.permission === 'default') {
    console.log('   You can request permission by calling Notification.requestPermission()');
  }
} else {
  console.log('   ✗ Notification API not available');
}

console.log('\n=== Verification Complete ===');
console.log('\nTo test FCM functionality:');
console.log('1. Ensure VITE_FCM_VAPID_KEY is set in your .env file');
console.log('2. Check that firebase-messaging-sw.js exists in the public directory');
console.log('3. Verify service worker registration in browser dev tools');
console.log('4. Test by calling window.getFcmToken() in the browser console');