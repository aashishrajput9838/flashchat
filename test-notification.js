// Test script to verify notification system
const testNotification = async () => {
  try {
    // Test the Railway backend endpoint
    const response = await fetch('https://flashchat-production.up.railway.app/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: 'test-token',
        title: 'Test Notification',
        body: 'This is a test notification',
        icon: '/icon-192x192.png'
      })
    });
    
    const result = await response.json();
    console.log('Backend response:', result);
    
    if (result.success === false && result.error) {
      console.log('Expected error (no valid token):', result.error);
      console.log('Backend is working correctly!');
    } else {
      console.log('Unexpected response from backend');
    }
  } catch (error) {
    console.error('Error testing notification system:', error);
  }
};

testNotification();