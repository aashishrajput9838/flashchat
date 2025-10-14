import { db } from './firebase';
import { collection, doc, setDoc, query, orderBy, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from './userService';

// Function to send a message to Firestore
export const sendMessage = async (messageData, recipientUserId) => {
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      const messagesRef = collection(db, 'messages');
      const timestamp = new Date();
      
      // Get the first 5 words of the message (limit to 30 characters to keep ID reasonable)
      const firstWords = messageData.text.split(' ').slice(0, 5).join('_').substring(0, 30);
      
      // Create a readable document ID: timestamp + first 5 words (sanitized)
      const userIdentifier = user ? (user.displayName || user.email || user.uid).replace(/\s+/g, '_').substring(0, 10) : 'anonymous';
      // Sanitize the firstWords to remove special characters that might cause issues with Firestore document IDs
      const sanitizedFirstWords = firstWords.replace(/[^a-zA-Z0-9_]/g, '');
      const readableId = `${timestamp.getTime()}_${sanitizedFirstWords}`;
      
      // Ensure we always have user data, even if getCurrentUser returns null
      const message = {
        text: messageData.text,
        name: messageData.name || (user && user.displayName) ? user.displayName : 'Anonymous',
        userId: user ? user.uid : 'anonymous',
        recipientId: recipientUserId, // Add recipient ID for conversation tracking
        timestamp: serverTimestamp(),
        createdAt: timestamp, // Add a client-side timestamp as backup
        you: messageData.you || false,
        photoURL: messageData.photoURL || (user && user.photoURL) ? user.photoURL : null,
        readableId: readableId // Keep this for reference
      };
      
      // Use setDoc with custom ID instead of addDoc
      const docRef = doc(messagesRef, readableId);
      await setDoc(docRef, message);
      return readableId;
    } catch (error) {
      console.error('Error sending message to Firestore:', error);
      // Don't throw error, just return null to indicate failure
      return null;
    }
  } else {
    console.warn('Firestore not available, message not sent');
    return null;
  }
};

// Function to subscribe to messages from Firestore for a specific conversation
export const subscribeToMessages = (selectedUserId, callback) => {
  // Only subscribe to Firestore if it's available
  if (db) {
    try {
      const messagesRef = collection(db, 'messages');
      const currentUser = getCurrentUser();
      
      // If no selected user or no current user, return empty array
      if (!selectedUserId || !currentUser) {
        callback([]);
        return () => {};
      }
      
      // Use a simpler query that doesn't require composite indexes
      // Query all messages and filter client-side
      const q = query(messagesRef, orderBy('timestamp'));
      
      return onSnapshot(q, (querySnapshot) => {
        const messages = [];
        const user = getCurrentUser();
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Filter messages for the specific conversation on the client side
          // Only include messages between current user and selected user
          if (data.userId && data.recipientId) {
            if ((data.userId === user.uid && data.recipientId === selectedUserId) ||
                (data.userId === selectedUserId && data.recipientId === user.uid)) {
              messages.push({
                id: doc.id,
                ...data,
                you: user ? data.userId === user.uid : false,
                time: data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                      (data.createdAt ? data.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now')
              });
            }
          }
        });
        
        // Sort messages by timestamp
        messages.sort((a, b) => {
          const timeA = a.timestamp ? a.timestamp.toDate().getTime() : (a.createdAt ? a.createdAt.getTime() : 0);
          const timeB = b.timestamp ? b.timestamp.toDate().getTime() : (b.createdAt ? b.createdAt.getTime() : 0);
          return timeA - timeB;
        });
        
        callback(messages);
      }, (error) => {
        console.error('Error subscribing to messages:', error);
        // Return empty array on error but don't break the app
        callback([]); // Return empty array on error
      });
    } catch (error) {
      console.error('Error setting up message subscription:', error);
      callback([]); // Return empty array on error
      return () => {}; // Return empty unsubscribe function
    }
  } else {
    console.warn('Firestore not available, returning empty message list');
    callback([]); // Return empty array if Firestore is not available
    return () => {}; // Return empty unsubscribe function
  }
};