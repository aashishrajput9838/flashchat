import { db } from './firebase';
import { collection, doc, setDoc, query, orderBy, where, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { getCurrentUser } from './userService';
import { handleFirestoreError } from './firebase';

// Function to send a message to Firestore
export const sendMessage = async (messageData, recipientUserId) => {
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      const messagesRef = collection(db, 'messages');
      
      // Simplified message object without custom ID generation
      const message = {
        text: messageData.text,
        name: messageData.name || (user && user.displayName) ? user.displayName : 'Anonymous',
        userId: user ? user.uid : 'anonymous',
        recipientId: recipientUserId,
        timestamp: serverTimestamp(), // Use server timestamp for better consistency
        you: messageData.you || false,
        photoURL: messageData.photoURL || (user && user.photoURL) ? user.photoURL : null
      };
      
      // Use addDoc to let Firestore generate the ID
      const docRef = await addDoc(messagesRef, message);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error);
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
      const currentUser = getCurrentUser();
      
      // If no selected user or no current user, return empty array
      if (!selectedUserId || !currentUser) {
        callback([]);
        return () => {};
      }
      
      // Create a more efficient query that filters on the server side
      // Query messages between current user and selected user
      const messagesRef = collection(db, 'messages');
      const q1 = query(
        messagesRef, 
        where('userId', '==', currentUser.uid),
        where('recipientId', '==', selectedUserId),
        orderBy('timestamp')
      );
      
      const q2 = query(
        messagesRef, 
        where('userId', '==', selectedUserId),
        where('recipientId', '==', currentUser.uid),
        orderBy('timestamp')
      );
      
      // Combine both queries
      const unsubscribe1 = onSnapshot(q1, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messages.push({
            id: doc.id,
            ...data,
            you: true,
            time: data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
          });
        });
        
        // Get messages from the other user
        const unsubscribe2 = onSnapshot(q2, (snapshot2) => {
          snapshot2.forEach((doc) => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              ...data,
              you: false,
              time: data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
            });
          });
          
          // Sort all messages by timestamp
          messages.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp.toDate()).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp.toDate()).getTime() : 0;
            return timeA - timeB;
          });
          
          callback(messages);
        }, (error) => {
          handleFirestoreError(error);
          callback(messages); // Return what we have so far
        });
      }, (error) => {
        handleFirestoreError(error);
        callback([]);
      });
      
      // Return a function that unsubscribes from both queries
      return () => {
        unsubscribe1();
      };
    } catch (error) {
      handleFirestoreError(error);
      callback([]);
      return () => {};
    }
  } else {
    console.warn('Firestore not available, returning empty message list');
    callback([]);
    return () => {};
  }
};