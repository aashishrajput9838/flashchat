require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
let admin;
const { getFirestore, doc, updateDoc, serverTimestamp } = require('firebase/firestore');

const app = express();
const server = http.createServer(app);

// Enable CORS BEFORE any other middleware
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
    "https://flashchat-git-main-yourusername.vercel.app",
    // Add Railway deployment URL
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined,
    // Add production Railway URL pattern
    "https://*.railway.app",
    // Add specific Railway domain for flashchat
    "https://flashchat-production-ea1a.up.railway.app"
  ].filter(Boolean), // Remove undefined values
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Note: Express 5 uses a stricter path matcher; per-route OPTIONS handlers are defined
// where needed (e.g. /api/upload-file) instead of a global wildcard.

// Add this before any other middleware to log all requests
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.path} from ${req.get('Origin') || 'unknown origin'}`);
  next();
});

app.use(express.json());
app.use(express.static('public')); // Serve static files

// Add middleware to handle file uploads
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Create uploads directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// sharp is optional in some environments (e.g., where native modules cannot be built)
// Try to load it, but don't crash the server if it's unavailable.
let sharp = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('Optional dependency "sharp" is not available. Image thumbnails will be disabled.', error.message);
}

// Create uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Firebase Admin SDK initialization
try {
  // Lazily require firebase-admin so that a failure does not crash the process
  const firebaseAdmin = require('firebase-admin');

  // Check if we're running in a Railway environment
  if (process.env.RAILWAY_PROJECT_ID) {
    // Use default credentials in Railway environment
    // Try to initialize with explicit project ID if available
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      firebaseAdmin.initializeApp({
        projectId: projectId
      });
      console.log(`Firebase Admin initialized with project ID: ${projectId}`);
    } else {
      // Fallback to default initialization
      firebaseAdmin.initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    }
  } else {
    // For local development, use the service account key file
    const serviceAccount = require('./service-account-key.json');
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with service account key');
  }

  admin = firebaseAdmin;
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  // Continue without Firebase Admin if initialization fails
  admin = null;
}

const messaging = admin ? admin.messaging() : null;

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

// Initialize Socket.IO with CORS configuration
// Use a function for origin to avoid subtle mismatches between HTTPS/WSS origins
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) and our web clients
      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    credentials: true
  }
});

// Store active calls and their participants
const activeCalls = new Map();

// Endpoint to update user FCM token
app.post('/api/update-fcm-token', async (req, res) => {
  console.log('Received FCM token update request from:', req.get('Origin'));
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Set CORS headers explicitly for this endpoint
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  try {
    const { userId, fcmToken } = req.body;
    
    // Validate required fields
    if (!userId || !fcmToken) {
      console.log('Missing userId or fcmToken in request');
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
  console.log('Received notification request from:', req.get('Origin'));
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Set CORS headers explicitly for this endpoint
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  try {
    const { token, title, body, icon, data } = req.body;
    
    // Validate required fields
    if (!token || !title) {
      return res.status(400).json({ success: false, error: 'Missing token or title' });
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
        title: title,
        body: body || ''
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
            body: body || ''
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
    // Provide more specific error messages
    if (error.code === 'messaging/invalid-argument') {
      return res.status(400).json({ success: false, error: 'The registration token is not a valid FCM registration token' });
    }
    if (error.code === 'messaging/invalid-registration-token') {
      return res.status(400).json({ success: false, error: 'The registration token is not a valid FCM registration token' });
    }
    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(400).json({ success: false, error: 'The registration token is not registered' });
    }
    // For any other error, still return success to prevent breaking the main application flow
    console.warn('Non-critical notification error, continuing with success response');
    res.status(200).json({ success: true, messageId: null, warning: 'Notification failed but operation continued' });
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

// Log when the server is about to start
console.log('About to start server on port:', process.env.PORT || 8080);

const PORT = process.env.PORT || 8080; // Use Railway's PORT or default to 8080

// Add this before starting the server to debug CORS issues
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.path} from ${req.get('Origin')}`);
  next();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Call management server running on port ${PORT}`);
  console.log(`Server listening on port ${PORT}`);
  // Log that the server is listening
  console.log(`Server is now listening for requests on port ${PORT}`);
});

// Add a simple test endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', port: PORT, timestamp: new Date().toISOString() });
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

// Add a simple test endpoint
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Add file upload endpoint (with explicit CORS handling)
// Handle preflight for this specific route
app.options('/api/upload-file', cors());

app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  // Ensure CORS headers are present on all responses from this endpoint
  const origin = req.get('Origin') || 'https://flashchat-coral.vercel.app';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Generate file URL for original upload
    const fileUrl = `/uploads/${req.file.filename}`;

    // Optionally generate a JPEG thumbnail for images to improve chat performance
    let thumbnailUrl = null;
    try {
      // Only attempt thumbnail generation if sharp is available
      if (sharp && req.file.mimetype && req.file.mimetype.startsWith('image/')) {
        const thumbName = `thumb-${req.file.filename}.jpg`;
        const thumbPath = path.join(uploadDir, thumbName);

        await sharp(req.file.path)
          .resize(400) // constrain width, preserve aspect ratio
          .jpeg({ quality: 70 })
          .toFile(thumbPath);

        thumbnailUrl = `/uploads/${thumbName}`;
      }
    } catch (thumbError) {
      // Thumbnail generation is best-effort; log but don't fail the upload
      console.error('Error generating thumbnail:', thumbError);
    }
    
    // Return file information
    res.status(200).json({
      success: true,
      file: {
        url: fileUrl,
        thumbnailUrl,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add file download endpoint
app.get('/api/download-file/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename to prevent directory traversal attacks
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }
  
  const filePath = path.join(__dirname, 'uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  
  // Set headers to force download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  
  // Send file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error downloading file' });
      }
    }
  });
});
