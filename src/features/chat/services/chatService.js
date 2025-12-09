import { db } from '@/config/firebase';
import { collection, doc, query, orderBy, where, onSnapshot, serverTimestamp, addDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { getCurrentUser } from '@/features/user/services/userService';
import { handleFirestoreError } from '@/config/firebase';
import { sendMessageNotification } from '@/features/notifications/services/notificationService';

/**
 * Function to send a message to Firestore
 * @param {Object} messageData - The message data to send
 * @param {string} recipientUserId - The Firebase UID of the message recipient
 * @returns {Promise<string|null>} - The document ID of the sent message, or null if failed
 */
export const sendMessage = async (messageData, recipientUserId) => {
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      
      // Validate required data
      if (!user || !recipientUserId) {
        console.error('Missing user or recipient data');
        return null;
      }
      
      const messagesRef = collection(db, 'messages');
      
      // Create message object
      const message = {
        text: messageData.text,
        name: messageData.name || (user.displayName) || 'Anonymous',
        userId: user.uid,
        recipientId: recipientUserId,
        timestamp: serverTimestamp(), // Use server timestamp for better consistency
        you: messageData.you || false,
        photoURL: messageData.photoURL || (user.photoURL) || null,
        status: 'sent' // initial status for message ticks
      };
      
      // Use addDoc to let Firestore generate the ID
      const docRef = await addDoc(messagesRef, message);
      
      // Send notification to recipient
      await sendMessageNotification(recipientUserId, message.name, message.text);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error sending message:', error);
      // Don't throw error, just return null to indicate failure
      return null;
    }
  } else {
    console.warn('Firestore not available, message not sent');
    return null;
  }
};

/**
 * Function to send a file message to Firestore
 * @param {Object} fileMessageData - The file message data to send
 * @param {string} recipientUserId - The Firebase UID of the message recipient
 * @returns {Promise<string|null>} - The document ID of the sent message, or null if failed
 */
export const sendFileMessage = async (fileMessageData, recipientUserId) => {
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      
      // Validate required data
      if (!user || !recipientUserId) {
        console.error('Missing user or recipient data');
        return null;
      }
      
      const messagesRef = collection(db, 'messages');
      
      // Create message object for file
      const message = {
        text: fileMessageData.text,
        name: fileMessageData.name || (user.displayName) || 'Anonymous',
        userId: user.uid,
        recipientId: recipientUserId,
        timestamp: serverTimestamp(), // Use server timestamp for better consistency
        you: fileMessageData.you || false,
        photoURL: fileMessageData.photoURL || (user.photoURL) || null,
        fileType: fileMessageData.fileType || 'file',
        fileUrl: fileMessageData.fileUrl,
        fileName: fileMessageData.fileName,
        thumbnailUrl: fileMessageData.thumbnailUrl || null,
        status: 'sent' // initial status for file message ticks
      };
      
      // Use addDoc to let Firestore generate the ID
      const docRef = await addDoc(messagesRef, message);
      
      // Send notification to recipient
      await sendMessageNotification(recipientUserId, message.name, message.text);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error sending file message:', error);
      // Don't throw error, just return null to indicate failure
      return null;
    }
  } else {
    console.warn('Firestore not available, file message not sent');
    return null;
  }
};

/**
 * Function to subscribe to messages from Firestore for a specific conversation
 * @param {string} selectedUserId - The Firebase UID of the conversation partner
 * @param {Function} callback - Called with an array of messages when updates occur
 * @returns {Function} - Unsubscribe function to clean up the listener
 */
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
      
      // Create a single efficient query that gets messages between both users
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('userId', 'in', [currentUser.uid, selectedUserId]),
        where('recipientId', 'in', [currentUser.uid, selectedUserId]),
        orderBy('timestamp', 'asc')
      );
      
      // Subscribe to the query
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const messages = [];
        const deliveryUpdates = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // Queue delivery status update for messages that reached this client as recipient
          if (
            data.recipientId === currentUser.uid &&
            (!data.status || data.status === 'sent')
          ) {
            deliveryUpdates.push({ id: docSnap.id });
          }

          messages.push({
            id: docSnap.id,
            ...data,
            you: data.userId === currentUser.uid,
            time: data.timestamp && data.timestamp.toDate && typeof data.timestamp.toDate === 'function'
              ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now'
          });
        });

        // Mark messages as delivered in Firestore (single tick -> double tick)
        if (deliveryUpdates.length > 0 && db) {
          try {
            const batch = writeBatch(db);
            deliveryUpdates.forEach((msg) => {
              const msgRef = doc(db, 'messages', msg.id);
              batch.update(msgRef, { status: 'delivered' });
            });
            await batch.commit();
          } catch (error) {
            handleFirestoreError(error);
          }
        }

        callback(messages);
      }, (error) => {
        handleFirestoreError(error);
        callback([]);
      });
      
      // Return the unsubscribe function
      return unsubscribe;
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

/**
 * Mark all messages from a specific user to the current user as read.
 * This is called when the current user opens a chat thread so the sender
 * can see blue double ticks.
 * @param {string} selectedUserId - The UID of the conversation partner
 */
export const markMessagesAsRead = async (selectedUserId) => {
  if (!db) {
    console.warn('Firestore not available, skipping markMessagesAsRead');
    return;
  }

  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !selectedUserId) {
      return;
    }

    const messagesRef = collection(db, 'messages');
    // All messages where selected user sent to current user and are not yet marked read
    const q = query(
      messagesRef,
      where('userId', '==', selectedUserId),
      where('recipientId', '==', currentUser.uid),
      where('status', 'in', ['sent', 'delivered'])
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, { status: 'read' });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error);
  }
};

/**
 * Function to subscribe to latest messages for conversation list
 * @param {Function} callback - Called with an array of latest messages when updates occur
 * @returns {Function} - Unsubscribe function to clean up the listener
 */
export const subscribeToLatestMessages = (callback) => {
  if (db) {
    try {
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        callback([]);
        return () => {};
      }
      
      // Get all messages where current user is either sender or recipient
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const latestMessages = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          const otherUserId = data.recipientId;
          
          // Only keep the most recent message for each conversation
          if (!latestMessages[otherUserId] || 
              (data.timestamp && data.timestamp.toDate && 
               latestMessages[otherUserId].timestamp && latestMessages[otherUserId].timestamp.toDate &&
               data.timestamp.toDate() > latestMessages[otherUserId].timestamp.toDate())) {
            latestMessages[otherUserId] = {
              id: doc.id,
              ...data,
              otherUserId: otherUserId
            };
          }
        });
        
        // Also get messages where current user is recipient
        const q2 = query(
          messagesRef,
          where('recipientId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        
        const unsubscribe2 = onSnapshot(q2, (snapshot2) => {
          snapshot2.forEach((doc) => {
            const data = doc.data();
            const otherUserId = data.userId;
            
            // Only keep the most recent message for each conversation
            if (!latestMessages[otherUserId] || 
                (data.timestamp && data.timestamp.toDate && 
                 latestMessages[otherUserId].timestamp && latestMessages[otherUserId].timestamp.toDate &&
                 data.timestamp.toDate() > latestMessages[otherUserId].timestamp.toDate())) {
              latestMessages[otherUserId] = {
                id: doc.id,
                ...data,
                otherUserId: otherUserId
              };
            }
          });
          
          callback(Object.values(latestMessages));
        }, (error) => {
          handleFirestoreError(error);
          callback(Object.values(latestMessages));
        });
        
        // Return unsubscribe function for both queries
        return () => {
          unsubscribe();
          unsubscribe2();
        };
      }, (error) => {
        handleFirestoreError(error);
        callback([]);
      });
      
      return unsubscribe;
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

/**
 * Function to add a reaction to a message
 * @param {string} messageId - The ID of the message to react to
 * @param {string} emoji - The emoji to add as a reaction
 * @returns {Promise<boolean>} - True if successful, false if failed
 */
export const addReactionToMessage = async (messageId, emoji) => {
  if (!db) {
    console.warn('Firestore not available, skipping addReactionToMessage');
    return false;
  }

  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !messageId || !emoji) {
      console.error('Missing required parameters for addReactionToMessage');
      return false;
    }

    const messageRef = doc(db, 'messages', messageId);
    
    // Get the current message data to check existing reactions
    // In a production app, you might want to use a transaction here
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${currentUser.uid}`]: {
        userId: currentUser.uid,
        name: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp()
      }
    });

    return true;
  } catch (error) {
    handleFirestoreError(error);
    console.error('Error adding reaction to message:', error);
    // Return a more specific error message
    if (error.code === 'permission-denied') {
      throw new Error('You do not have permission to react to this message');
    } else if (error.code === 'not-found') {
      throw new Error('Message not found');
    } else {
      throw new Error('Failed to add reaction. Please try again.');
    }
  }
};

/**
 * Function to remove a reaction from a message
 * @param {string} messageId - The ID of the message to remove reaction from
 * @param {string} emoji - The emoji to remove as a reaction
 * @returns {Promise<boolean>} - True if successful, false if failed
 */
export const removeReactionFromMessage = async (messageId, emoji) => {
  if (!db) {
    console.warn('Firestore not available, skipping removeReactionFromMessage');
    return false;
  }

  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !messageId || !emoji) {
      console.error('Missing required parameters for removeReactionFromMessage');
      return false;
    }

    const messageRef = doc(db, 'messages', messageId);
    
    // Remove the user's reaction for this emoji
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${currentUser.uid}`]: null
    });

    return true;
  } catch (error) {
    handleFirestoreError(error);
    console.error('Error removing reaction from message:', error);
    // Return a more specific error message
    if (error.code === 'permission-denied') {
      throw new Error('You do not have permission to remove this reaction');
    } else if (error.code === 'not-found') {
      throw new Error('Message not found');
    } else {
      throw new Error('Failed to remove reaction. Please try again.');
    }
  }
};
