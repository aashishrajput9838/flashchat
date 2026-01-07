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
  console.log('sendMessage called with:', { messageData, recipientUserId });
  
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      console.log('Current user:', user?.uid);
      
      // Validate required data
      if (!user || !recipientUserId) {
        console.error('Missing user or recipient data', { user: !!user, recipientUserId: !!recipientUserId });
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
      
      console.log('Creating message document with data:', message);
      
      // Use addDoc to let Firestore generate the ID
      const docRef = await addDoc(messagesRef, message);
      console.log('Message document created with ID:', docRef.id);
      
      // Send notification to recipient
      console.log('Sending notification to recipient:', recipientUserId);
      await sendMessageNotification(recipientUserId, message.name, message.text);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error sending message:', error);
      console.error('Message data:', messageData);
      console.error('Recipient ID:', recipientUserId);
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
  console.log('sendFileMessage called with:', { fileMessageData, recipientUserId });
  
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const user = getCurrentUser();
      console.log('Current user:', user?.uid);
      
      // Validate required data
      if (!user || !recipientUserId) {
        console.error('Missing user or recipient data', { user: !!user, recipientUserId: !!recipientUserId });
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
      
      console.log('Creating file message document with data:', message);
      
      // Use addDoc to let Firestore generate the ID
      const docRef = await addDoc(messagesRef, message);
      console.log('File message document created with ID:', docRef.id);
      
      // Send notification to recipient
      console.log('Sending notification to recipient:', recipientUserId);
      await sendMessageNotification(recipientUserId, message.name, message.text);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error sending file message:', error);
      console.error('File message data:', fileMessageData);
      console.error('Recipient ID:', recipientUserId);
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
  console.log('subscribeToMessages called with:', selectedUserId);
  
  // Only subscribe to Firestore if it's available
  if (db) {
    try {
      const currentUser = getCurrentUser();
      console.log('Current user:', currentUser?.uid);
      
      // If no selected user or no current user, return empty array
      if (!selectedUserId || !currentUser) {
        console.warn('Missing user data for subscribeToMessages', { 
          selectedUserId: !!selectedUserId, 
          currentUser: !!currentUser 
        });
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
      
      console.log('Subscribing to messages between', currentUser.uid, 'and', selectedUserId);
      
      // Subscribe to the query
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          console.log('Received message snapshot with', snapshot.size, 'documents');
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

          console.log('Processed messages:', messages.length, 'Delivery updates:', deliveryUpdates.length);
          
          // Mark messages as delivered in Firestore (single tick -> double tick)
          if (deliveryUpdates.length > 0 && db) {
            try {
              console.log('Updating', deliveryUpdates.length, 'messages to delivered status');
              const batch = writeBatch(db);
              deliveryUpdates.forEach((msg) => {
                const msgRef = doc(db, 'messages', msg.id);
                batch.update(msgRef, { status: 'delivered' });
              });
              await batch.commit();
              console.log('Successfully updated messages to delivered status');
            } catch (error) {
              handleFirestoreError(error);
              console.error('Error updating message statuses to delivered:', error);
            }
          }

          callback(messages);
        } catch (error) {
          console.error('Error processing message snapshot:', error);
          callback([]);
        }
      }, (error) => {
        handleFirestoreError(error);
        console.error('Error in message subscription:', error);
        callback([]);
      });
      
      // Return the unsubscribe function
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error setting up message subscription:', error);
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
  console.log('markMessagesAsRead called with:', selectedUserId);
  
  if (!db) {
    console.warn('Firestore not available, skipping markMessagesAsRead');
    return;
  }

  try {
    const currentUser = getCurrentUser();
    console.log('Current user:', currentUser?.uid);
    
    if (!currentUser || !selectedUserId) {
      console.warn('Missing user data for markMessagesAsRead', { 
        currentUser: !!currentUser, 
        selectedUserId: !!selectedUserId 
      });
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

    console.log('Executing query for messages to mark as read');
    const snapshot = await getDocs(q);
    console.log('Found', snapshot.size, 'messages to mark as read');
    
    if (snapshot.empty) {
      console.log('No messages to mark as read');
      return;
    }

    const batch = writeBatch(db);
    let updateCount = 0;
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, { status: 'read' });
      updateCount++;
    });
    
    console.log('Updating', updateCount, 'messages to read status');
    await batch.commit();
    console.log('Successfully marked', updateCount, 'messages as read');
  } catch (error) {
    handleFirestoreError(error);
    console.error('Error in markMessagesAsRead:', error);
    console.error('Selected user ID:', selectedUserId);
  }
};

/**
 * Function to subscribe to latest messages for conversation list
 * @param {Function} callback - Called with an array of latest messages when updates occur
 * @returns {Function} - Unsubscribe function to clean up the listener
 */
export const subscribeToLatestMessages = (callback) => {
  console.log('subscribeToLatestMessages called');
  
  if (db) {
    try {
      const currentUser = getCurrentUser();
      console.log('Current user:', currentUser?.uid);
      
      if (!currentUser) {
        console.warn('No current user, returning empty latest messages');
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
      
      console.log('Subscribing to latest messages where user is sender');
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          console.log('Received sender messages snapshot with', snapshot.size, 'documents');
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
          
          console.log('Processed sender messages, found', Object.keys(latestMessages).length, 'conversations');
          
          // Also get messages where current user is recipient
          const q2 = query(
            messagesRef,
            where('recipientId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
          );
          
          console.log('Subscribing to latest messages where user is recipient');
          
          const unsubscribe2 = onSnapshot(q2, (snapshot2) => {
            try {
              console.log('Received recipient messages snapshot with', snapshot2.size, 'documents');
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
              
              console.log('Processed recipient messages, total conversations:', Object.keys(latestMessages).length);
              callback(Object.values(latestMessages));
            } catch (error2) {
              console.error('Error processing recipient messages:', error2);
              callback(Object.values(latestMessages));
            }
          }, (error) => {
            handleFirestoreError(error);
            console.error('Error in recipient messages subscription:', error);
            callback(Object.values(latestMessages));
          });
          
          // Return unsubscribe function for both queries
          return () => {
            unsubscribe();
            unsubscribe2();
          };
        } catch (error) {
          console.error('Error processing sender messages:', error);
          callback([]);
        }
      }, (error) => {
        handleFirestoreError(error);
        console.error('Error in sender messages subscription:', error);
        callback([]);
      });
      
      return unsubscribe;
    } catch (error) {
      handleFirestoreError(error);
      console.error('Error setting up latest messages subscription:', error);
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
  console.log('[Reaction] addReactionToMessage called with:', { messageId, emoji });
  
  if (!db) {
    console.warn('[Reaction] Firestore not available, skipping addReactionToMessage');
    return false;
  }

  try {
    const currentUser = getCurrentUser();
    console.log('[Reaction] Current user:', currentUser?.uid);
    
    if (!currentUser || !messageId || !emoji) {
      console.error('[Reaction] Missing required parameters for addReactionToMessage', { 
        currentUser: !!currentUser, 
        messageId: !!messageId, 
        emoji: !!emoji 
      });
      return false;
    }

    const messageRef = doc(db, 'messages', messageId);
    console.log('[Reaction] Updating message document:', messageId);
    
    // Get the current message data to check existing reactions
    // In a production app, you might want to use a transaction here
    const reactionData = {
      userId: currentUser.uid,
      name: currentUser.displayName || 'Anonymous',
      timestamp: serverTimestamp()
    };
    
    console.log('[Reaction] Adding reaction data:', reactionData);
    
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${currentUser.uid}`]: reactionData
    });

    console.log('[Reaction] Successfully added reaction to message:', messageId);
    return true;
  } catch (error) {
    handleFirestoreError(error);
    console.error('[Reaction] Error adding reaction to message:', error);
    console.error('[Reaction] Parameters:', { messageId, emoji });
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
  console.log('[Reaction] removeReactionFromMessage called with:', { messageId, emoji });
  
  if (!db) {
    console.warn('[Reaction] Firestore not available, skipping removeReactionFromMessage');
    return false;
  }

  try {
    const currentUser = getCurrentUser();
    console.log('[Reaction] Current user:', currentUser?.uid);
    
    if (!currentUser || !messageId || !emoji) {
      console.error('[Reaction] Missing required parameters for removeReactionFromMessage', { 
        currentUser: !!currentUser, 
        messageId: !!messageId, 
        emoji: !!emoji 
      });
      return false;
    }

    const messageRef = doc(db, 'messages', messageId);
    console.log('[Reaction] Removing reaction from message document:', messageId);
    
    // Remove the user's reaction for this emoji
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${currentUser.uid}`]: null
    });

    console.log('[Reaction] Successfully removed reaction from message:', messageId);
    return true;
  } catch (error) {
    handleFirestoreError(error);
    console.error('[Reaction] Error removing reaction from message:', error);
    console.error('[Reaction] Parameters:', { messageId, emoji });
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
