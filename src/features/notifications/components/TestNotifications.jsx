import React, { useState } from 'react';
import { getCurrentUser } from '@/features/user/services/userService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const TestNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const sendTestNotification = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Get the current user's FCM token
      const user = getCurrentUser();
      if (!user) {
        throw new Error('No user logged in');
      }
      
      // Get user's FCM token from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;
      
      if (!fcmToken) {
        throw new Error('No FCM token found for user');
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
        setResult({ success: true, message: 'Test notification sent successfully!' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      setResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Test Notifications</h2>
      
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        Click the button below to send a test notification to your device.
        Make sure you've granted notification permissions in your browser.
      </p>
      
      <button
        type="button"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
        onClick={sendTestNotification}
        disabled={loading}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending...
          </>
        ) : (
          'Send Test Notification'
        )}
      </button>
      
      {result && (
        <div className={`mt-3 p-3 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
};

export default TestNotifications;