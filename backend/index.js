require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const { getFirestore, doc, updateDoc, serverTimestamp } = require('firebase/firestore');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Firebase Admin SDK initialization
try {
  // Check if we're running in a Railway environment
  if (process.env.RAILWAY_PROJECT_ID) {
    // Use default credentials in Railway environment
    admin.initializeApp();
  } else {
    // For local development, use the service account key file
    const serviceAccount = require('./service-account-key.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  // Continue without Firebase Admin if initialization fails
  admin = null;
}

const messaging = admin.messaging();

// Helper function to update user FCM token
async function updateUserFcmToken(userId, fcmToken) {
  // Skip if Firestore is not available
  if (!db) {
    console.warn('Firestore not available, skipping FCM token update');
    return;
  }
  
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { 
      fcmToken: fcmToken,
      lastTokenUpdate: serverTimestamp()
    });
    console.log(`FCM token updated for user ${userId}`);
  } catch (error) {
    console.error(`Error updating FCM token for user ${userId}:`, error);
  }
}

// Firebase configuration (from environment variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyB_3xErgKerW8IsWLQzu6IsMyiXNOPSxEo",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "web-socket-2e05f.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "web-socket-2e05f",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "web-socket-2e05f.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "213332457740",
  appId: process.env.FIREBASE_APP_ID || "1:213332457740:web:dbfe9e380e1629d0427129",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-RYFQE7TFGN"
};

// Initialize Firebase Client SDK for Firestore access
const { initializeApp } = require('firebase/app');
// Only initialize Firebase client if needed for direct Firestore access
let db;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
  console.log('Firebase Client initialized successfully');
} catch (error) {
  console.error('Firebase Client initialization error:', error);
  db = null;
}

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", 
      "http://localhost:5174", 
      "http://localhost:5175", 
      "http://localhost:5176", 
      "http://localhost:5177", 
      "http://localhost:5178", 
      "http://localhost:5179", 
      "http://localhost:5180",
      "https://flashchat-coral.vercel.app",
      "https://flashchat-git-main-yourusername.vercel.app", // Add your actual Vercel preview URLs as needed
      // Add Railway deployment URL
      process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined
    ].filter(Boolean), // Remove undefined values
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for Express
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://localhost:5174", 
    "http://localhost:5175", 
    "http://localhost:5176", 
    "http://localhost:5177", 
    "http://localhost:5178", 
    "http://localhost:5179", 
    "http://localhost:5180",
    "https://flashchat-coral.vercel.app",
    "https://flashchat-git-main-yourusername.vercel.app", // Add your actual Vercel preview URLs as needed
    // Add Railway deployment URL
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined
  ].filter(Boolean), // Remove undefined values
  credentials: true
}));

// Store active calls and their participants
const activeCalls = new Map();

// Endpoint to update user FCM token
app.post('/api/update-fcm-token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;
    
    // Validate required fields
    if (!userId || !fcmToken) {
      return res.status(400).json({ success: false, error: 'Missing userId or fcmToken' });
    }
    
    // Skip if Firestore is not available
    if (!db) {
      console.warn('Firestore not available, skipping FCM token update');
      return res.status(200).json({ success: true });
    }
    
    // Update user document with FCM token
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { 
      fcmToken: fcmToken,
      lastTokenUpdate: serverTimestamp()
    });
    
    console.log(`FCM token updated for user ${userId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to send FCM notifications
app.post('/api/send-notification', async (req, res) => {
  try {
    const { token, title, body, icon, data } = req.body;
    
    // Skip if messaging is not available
    if (!messaging) {
      console.warn('Firebase Messaging not available, skipping notification');
      return res.status(200).json({ success: true, messageId: null });
    }
    
    // Prepare FCM message payload - corrected format
    const message = {
      token: token,
      notification: {
        title: title,
        body: body
      }
    };
    
    // Add data payload if provided
    if (data) {
      message.data = {};
      // Convert all data values to strings as required by FCM
      for (const key in data) {
        message.data[key] = String(data[key]);
      }
    }
    
    // Set Android-specific options
    message.android = {
      priority: data?.priority === 'high' ? 'high' : 'normal',
      notification: {
        // Remove icon from here as it's not a valid field
        color: '#2563eb', // Blue color
        sound: 'default'
      }
    };
    
    // Set iOS-specific options
    message.apns = {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body
          },
          sound: 'default'
        }
      }
    };
    
    // Set web-specific options
    message.webpush = {
      headers: {
        Urgency: data?.priority === 'high' ? 'high' : 'normal'
      },
      fcmOptions: {
        link: data?.url || 'https://flashchat-coral.vercel.app'
      },
      notification: {
        // For web push, icon is set here
        icon: icon || '/icon-192x192.png',
        badge: '/icon-192x192.png'
      }
    };
    
    // Send notification
    const response = await messaging.send(message);
    
    console.log('Successfully sent message:', response);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Register user with their UID
  socket.on('register_user', (userId) => {
    try {
      // Validate user ID
      if (!userId) {
        console.error('Missing user ID for registration');
        return;
      }
      
      // Store the previous user ID if it exists
      const previousUserId = socket.userId;
      
      // Update socket user ID
      socket.userId = userId;
      console.log(`User ${userId} registered with socket ${socket.id}`);
      
      // If user ID changed, clean up previous user associations
      if (previousUserId && previousUserId !== userId) {
        console.log(`User ID changed from ${previousUserId} to ${userId} for socket ${socket.id}`);
      }
    } catch (error) {
      console.error('Error registering user:', error);
    }
  });
  
  // Update user FCM token
  socket.on('update_fcm_token', async (data) => {
    try {
      const { userId, fcmToken } = data;
      
      // Validate required fields
      if (!userId || !fcmToken) {
        console.error('Missing userId or fcmToken for token update');
        return;
      }
      
      // Update user FCM token
      await updateUserFcmToken(userId, fcmToken);
    } catch (error) {
      console.error('Error updating FCM token:', error);
    }
  });

  // Handle call initiation
  socket.on('initiate_call', (data) => {
    try {
      const { callId, callerId, calleeId, callType } = data;
      console.log(`Call initiated: ${callId} from ${callerId} to ${calleeId}`);
      
      // Validate required fields
      if (!callId || !callerId || !calleeId) {
        console.error('Missing required call fields:', data);
        return;
      }
      
      // Store call information
      activeCalls.set(callId, {
        callerId,
        calleeId,
        callType,
        startTime: new Date()
      });
      
      // Notify callee about incoming call
      socket.to(calleeId).emit('incoming_call', {
        callId,
        callerId,
        callType,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling call initiation:', error);
    }
  });

  // Handle call acceptance
  socket.on('accept_call', async (data) => {
    try {
      const { callId, calleeId } = data;
      console.log(`Call accepted: ${callId} by ${calleeId}`);
      
      // Validate required fields
      if (!callId || !calleeId) {
        console.error('Missing required call acceptance fields:', data);
        return;
      }
      
      // Update call status in Firestore
      await updateCallStatus(callId, 'accepted');
      
      // Notify caller that call was accepted
      const callInfo = activeCalls.get(callId);
      if (callInfo) {
        io.to(callInfo.callerId).emit('call_accepted', {
          callId,
          calleeId
        });
      }
    } catch (error) {
      console.error('Error handling call acceptance:', error);
    }
  });

  // Handle call rejection
  socket.on('reject_call', async (data) => {
    try {
      const { callId, calleeId } = data;
      console.log(`Call rejected: ${callId} by ${calleeId}`);
      
      // Validate required fields
      if (!callId || !calleeId) {
        console.error('Missing required call rejection fields:', data);
        return;
      }
      
      // Update call status in Firestore
      await updateCallStatus(callId, 'declined');
      
      // Clean up active call
      const callInfo = activeCalls.get(callId);
      activeCalls.delete(callId);
      
      // Notify caller that call was rejected
      if (callInfo) {
        io.to(callInfo.callerId).emit('call_rejected', {
          callId,
          calleeId
        });
      }
    } catch (error) {
      console.error('Error handling call rejection:', error);
    }
  });

  // Handle call end
  socket.on('end_call', async (data) => {
    try {
      const { callId, userId } = data;
      console.log(`Call ended: ${callId} by ${userId}`);
      
      // Validate required fields
      if (!callId || !userId) {
        console.error('Missing required call end fields:', data);
        return;
      }
      
      // Update call status in Firestore
      await updateCallStatus(callId, 'ended');
      
      // Clean up active call
      const callInfo = activeCalls.get(callId);
      activeCalls.delete(callId);
      
      // Notify other participant that call was ended
      if (callInfo) {
        const otherParticipant = userId === callInfo.callerId ? callInfo.calleeId : callInfo.callerId;
        console.log(`Notifying ${otherParticipant} that call ${callId} was ended by ${userId}`);
        io.to(otherParticipant).emit('call_ended', {
          callId,
          endedBy: userId
        });
      } else {
        console.log(`No active call found for ${callId}`);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    try {
      // If user was in a call, end it
      if (socket.userId) {
        // Find any active calls involving this user
        const callsToCleanUp = [];
        for (const [callId, callInfo] of activeCalls.entries()) {
          if (callInfo.callerId === socket.userId || callInfo.calleeId === socket.userId) {
            callsToCleanUp.push({ callId, callInfo });
          }
        }
        
        // End all calls involving this user
        for (const { callId, callInfo } of callsToCleanUp) {
          // Remove from active calls
          activeCalls.delete(callId);
          
          // Notify the other participant
          const otherParticipant = socket.userId === callInfo.callerId ? callInfo.calleeId : callInfo.callerId;
          if (otherParticipant) {
            io.to(otherParticipant).emit('call_ended', {
              callId,
              endedBy: socket.userId,
              reason: 'disconnect'
            });
          }
          
          // Update Firestore
          updateCallStatus(callId, 'ended');
        }
      }
    } catch (error) {
      console.error('Error handling user disconnect:', error);
    }
  });
});

// Helper function to update call status in Firestore with retry logic
async function updateCallStatus(callId, status) {
  // Skip if Firestore is not available
  if (!db) {
    console.warn('Firestore not available, skipping call status update');
    return;
  }
  
  try {
    const callRef = doc(db, 'calls', callId);
    const updateData = { status };
    
    // Add timestamp for specific statuses
    if (status === 'ended') {
      updateData.endedAt = serverTimestamp();
    } else if (status === 'accepted') {
      updateData.acceptedAt = serverTimestamp();
    } else if (status === 'declined') {
      updateData.declinedAt = serverTimestamp();
    } else if (status === 'ringing') {
      updateData.ringingAt = serverTimestamp();
    }
    
    await updateDoc(callRef, updateData);
  } catch (error) {
    console.error(`Error updating call ${callId} status to ${status}:`, error);
    // Try one more time
    try {
      const callRef = doc(db, 'calls', callId);
      const updateData = { status };
      
      if (status === 'ended') {
        updateData.endedAt = serverTimestamp();
      } else if (status === 'accepted') {
        updateData.acceptedAt = serverTimestamp();
      } else if (status === 'declined') {
        updateData.declinedAt = serverTimestamp();
      } else if (status === 'ringing') {
        updateData.ringingAt = serverTimestamp();
      }
      
      await updateDoc(callRef, updateData);
    } catch (retryError) {
      console.error(`Retry failed for updating call ${callId} status to ${status}:`, retryError);
    }
  }
}

const PORT = process.env.PORT || 3001; // Use Railway's PORT or default to 3001

server.listen(PORT, () => {
  console.log(`Call management server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // End all active calls
  for (const [callId, callInfo] of activeCalls.entries()) {
    // Update call status in Firestore
    updateCallStatus(callId, 'ended');
    
    // Notify participants
    if (callInfo.callerId) {
      io.to(callInfo.callerId).emit('call_ended', {
        callId,
        reason: 'server_shutdown'
      });
    }
    if (callInfo.calleeId) {
      io.to(callInfo.calleeId).emit('call_ended', {
        callId,
        reason: 'server_shutdown'
      });
    }
  }
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  // End all active calls
  for (const [callId, callInfo] of activeCalls.entries()) {
    // Update call status in Firestore
    updateCallStatus(callId, 'ended');
    
    // Notify participants
    if (callInfo.callerId) {
      io.to(callInfo.callerId).emit('call_ended', {
        callId,
        reason: 'server_shutdown'
      });
    }
    if (callInfo.calleeId) {
      io.to(callInfo.calleeId).emit('call_ended', {
        callId,
        reason: 'server_shutdown'
      });
    }
  }
  server.close(() => {
    console.log('Process terminated');
  });
});

// Test notification endpoint
app.post('/api/test-notification', async (req, res) => {
  try {
    console.log('Test notification request received:', req.body);
    const { token, title, body } = req.body;
    
    // Validate required fields
    if (!token) {
      console.error('Missing token in test notification request');
      return res.status(400).json({ success: false, error: 'Missing token' });
    }
    
    // Validate token format more thoroughly
    if (typeof token !== 'string' || token.length < 100 || token.length > 1000) {
      console.error('Invalid token format - length check failed:', token.length);
      return res.status(400).json({ success: false, error: 'Invalid token format' });
    }
    
    // Check for common invalid token patterns
    if (token.includes(' ') || token.includes('\n') || token.includes('\r')) {
      console.error('Invalid token format - contains whitespace');
      return res.status(400).json({ success: false, error: 'Invalid token format' });
    }
    
    // Skip if messaging is not available
    if (!messaging) {
      console.warn('Firebase Messaging not available, skipping notification');
      return res.status(200).json({ success: true, messageId: null });
    }
    
    // Prepare FCM message payload - corrected format
    const message = {
      token: token,
      notification: {
        title: title || 'Test Notification',
        body: body || 'This is a test notification'
      },
      data: {
        type: 'test',
        priority: 'high'
      }
    };
    
    console.log('Sending test notification with message:', JSON.stringify(message, null, 2));
    
    // Set Android-specific options
    message.android = {
      priority: 'high',
      notification: {
        color: '#2563eb',
        sound: 'default'
      }
    };
    
    // Set iOS-specific options
    message.apns = {
      payload: {
        aps: {
          alert: {
            title: title || 'Test Notification',
            body: body || 'This is a test notification'
          },
          sound: 'default'
        }
      }
    };
    
    // Set web-specific options
    message.webpush = {
      headers: {
        Urgency: 'high'
      },
      fcmOptions: {
        link: 'https://flashchat-coral.vercel.app'
      },
      notification: {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png'
      }
    };
    
    // Send notification
    const response = await messaging.send(message);
    
    console.log('Successfully sent test message:', response);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending test message:', error);
    // Provide more specific error messages
    if (error.code === 'messaging/invalid-argument') {
      return res.status(400).json({ success: false, error: 'The registration token is not a valid FCM registration token' });
    }
    if (error.code === 'messaging/invalid-registration-token') {
      return res.status(400).json({ success: false, error: 'The registration token is not a valid FCM registration token' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});