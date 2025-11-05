// Test notification script
// This script can be used to test the notification system

import { getCurrentUser } from './src/features/user/services/userService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function testNotification() {
  try {
    // Get the current user's FCM token
    const user = getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return;
    }
    
    // Get user's FCM token from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    
    if (!fcmToken) {
      console.error('No FCM token found for user');
      return;
    }
    
    // Send test notification via backend
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/test-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: fcmToken,
        title: 'Test Notification',
        body: 'This is a test notification from FlashChat'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Test notification sent successfully');
    } else {
      console.error('Failed to send test notification:', result.error);
    }
  } catch (error) {
    console.error('Error testing notification:', error);
  }
}

// Run the test
testNotification();