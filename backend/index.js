const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, serverTimestamp } = require('firebase/firestore');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Firebase configuration (matching your frontend config)
const firebaseConfig = {
  apiKey: "AIzaSyBk9R8fZDj0aflFVQrD4D4D4D4D4D4D4D4",
  authDomain: "web-socket-2e05f.firebaseapp.com",
  projectId: "web-socket-2e05f",
  storageBucket: "web-socket-2e05f.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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
      "https://flashchat-coral.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active calls and their participants
const activeCalls = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Register user with their UID
  socket.on('register_user', (userId) => {
    socket.userId = userId;
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  // Handle call initiation
  socket.on('initiate_call', (data) => {
    const { callId, callerId, calleeId, callType } = data;
    console.log(`Call initiated: ${callId} from ${callerId} to ${calleeId}`);
    
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
  });

  // Handle call acceptance
  socket.on('accept_call', async (data) => {
    const { callId, calleeId } = data;
    console.log(`Call accepted: ${callId} by ${calleeId}`);
    
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
  });

  // Handle call rejection
  socket.on('reject_call', async (data) => {
    const { callId, calleeId } = data;
    console.log(`Call rejected: ${callId} by ${calleeId}`);
    
    // Update call status in Firestore
    await updateCallStatus(callId, 'declined');
    
    // Clean up active call
    activeCalls.delete(callId);
    
    // Notify caller that call was rejected
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      io.to(callInfo.callerId).emit('call_rejected', {
        callId,
        calleeId
      });
    }
  });

  // Handle call end
  socket.on('end_call', async (data) => {
    const { callId, userId } = data;
    console.log(`Call ended: ${callId} by ${userId}`);
    
    try {
      // Update call status in Firestore
      await updateCallStatus(callId, 'ended');
      
      // Clean up active call
      activeCalls.delete(callId);
      
      // Notify other participant that call was ended
      const callInfo = activeCalls.get(callId);
      if (callInfo) {
        const otherParticipant = userId === callInfo.callerId ? callInfo.calleeId : callInfo.callerId;
        io.to(otherParticipant).emit('call_ended', {
          callId,
          endedBy: userId
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // If user was in a call, end it
    if (socket.userId) {
      // Find any active calls involving this user
      for (const [callId, callInfo] of activeCalls.entries()) {
        if (callInfo.callerId === socket.userId || callInfo.calleeId === socket.userId) {
          // End the call
          activeCalls.delete(callId);
          
          // Notify the other participant
          const otherParticipant = socket.userId === callInfo.callerId ? callInfo.calleeId : callInfo.callerId;
          io.to(otherParticipant).emit('call_ended', {
            callId,
            endedBy: socket.userId,
            reason: 'disconnect'
          });
          
          // Update Firestore
          updateCallStatus(callId, 'ended');
          break;
        }
      }
    }
  });
});

// Helper function to update call status in Firestore with retry logic
async function updateCallStatus(callId, status) {
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

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Call management server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // End all active calls
  for (const [callId, callInfo] of activeCalls.entries()) {
    io.to(callInfo.callerId).emit('call_ended', {
      callId,
      reason: 'server_shutdown'
    });
    io.to(callInfo.calleeId).emit('call_ended', {
      callId,
      reason: 'server_shutdown'
    });
  }
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  // End all active calls
  for (const [callId, callInfo] of activeCalls.entries()) {
    io.to(callInfo.callerId).emit('call_ended', {
      callId,
      reason: 'server_shutdown'
    });
    io.to(callInfo.calleeId).emit('call_ended', {
      callId,
      reason: 'server_shutdown'
    });
  }
  server.close(() => {
    console.log('Process terminated');
  });
});