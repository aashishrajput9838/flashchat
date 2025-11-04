const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const messaging = admin.messaging();

// Function to send FCM notifications
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { token, title, body, icon } = req.body;
    
    // Validate input
    if (!token || !title || !body) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: token, title, body' 
      });
      return;
    }
    
    // Send notification
    const response = await messaging.send({
      token: token,
      notification: {
        title: title,
        body: body,
        icon: icon || '/icon-192x192.png'
      }
    });
    
    console.log('Successfully sent message:', response);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});