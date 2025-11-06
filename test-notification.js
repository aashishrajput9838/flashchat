// Test notification script
// This script can be used to test the notification system

// Note: This script needs to be run in the browser environment, not Node.js
// The following is a template for how to test notifications in the browser console

async function testNotification() {
  try {
    console.log('Testing notification system...');
    
    // In a browser environment, you would import like this:
    // import { getCurrentUser } from './src/features/user/services/userService';
    // import { doc, getDoc } from 'firebase/firestore';
    // import { db } from './src/config/firebase';
    
    // But since we're testing in the browser console, we'll use the global objects
    
    // Get the current user's FCM token
    // This would normally be: const user = getCurrentUser();
    // For testing, you can check if user data is available in your app state
    
    console.log('To test notifications:');
    console.log('1. Open your FlashChat app in the browser');
    console.log('2. Make sure you have granted notification permissions');
    console.log('3. Open the browser console (F12)');
    console.log('4. Run the following code in the console:');
    console.log('');
    console.log('// Get current user FCM token');
    console.log('const user = getCurrentUser();');
    console.log('console.log("User ID:", user.uid);');
    console.log('');
    console.log('// Get FCM token from Firestore');
    console.log('getDoc(doc(db, "users", user.uid)).then(userDoc => {');
    console.log('  const userData = userDoc.data();');
    console.log('  const fcmToken = userData?.fcmToken;');
    console.log('  console.log("FCM Token:", fcmToken);');
    console.log('  ');
    console.log('  // Send test notification');
    console.log('  if (fcmToken) {');
    console.log('    fetch("http://localhost:3001/api/test-notification", {');
    console.log('      method: "POST",');
    console.log('      headers: { "Content-Type": "application/json" },');
    console.log('      body: JSON.stringify({');
    console.log('        token: fcmToken,');
    console.log('        title: "Test Notification",');
    console.log('        body: "This is a test notification from FlashChat"');
    console.log('      })');
    console.log('    }).then(response => response.json())');
    console.log('      .then(result => console.log("Result:", result));');
    console.log('  }');
    console.log('});');
    
  } catch (error) {
    console.error('Error in test notification script:', error);
  }
}

// Show instructions
testNotification();