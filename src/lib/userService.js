import { auth, db } from './firebase';
import { 
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  collection, 
  query, 
  where, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

// Function to get higher quality Google profile image
const getHighQualityPhotoURL = (photoURL) => {
  // If no photoURL, return null
  if (!photoURL) return null;
  
  try {
    // For Google profile pictures, we can request higher quality by modifying the URL
    // Google profile picture URLs typically end with ?sz= or have size parameters
    if (photoURL.includes('googleusercontent.com')) {
      // Remove any existing size parameters and set to higher quality (200px)
      let highQualityURL = photoURL.replace(/=s\d+/, '=s200');
      // If no size parameter exists, add one
      if (!photoURL.includes('=s')) {
        highQualityURL = photoURL.includes('?') 
          ? photoURL + '&sz=200' 
          : photoURL + '?sz=200';
      }
      return highQualityURL;
    }
    
    // Return original photoURL if not a Google profile picture
    return photoURL;
  } catch (error) {
    // If any error occurs, return the original photoURL
    console.warn('Error processing photoURL, returning original:', photoURL);
    return photoURL;
  }
};

// Current user state - now stores the full user data including Firestore data
let currentUser = null;
let currentUserFirestoreData = null; // Store Firestore data separately

// Function to initialize authentication
export const initAuth = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Set the auth user first
        currentUser = user;
        
        // Only interact with Firestore if it's available
        if (db) {
          try {
            // Check if user document exists in Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
              // Create user document if it doesn't exist
              const userData = {
                uid: user.uid,
                name: user.displayName || user.email || `User${Math.floor(Math.random() * 10000)}`,
                displayName: user.displayName,
                email: user.email || '',
                photoURL: getHighQualityPhotoURL(user.photoURL) || user.photoURL || '', // Keep original if processing fails
                friends: [], // Initialize empty friends array
                friendRequests: [], // Initialize empty friend requests array
                notifications: [], // Initialize empty notifications array
                createdAt: new Date()
              };
              
              await setDoc(doc(db, 'users', user.uid), userData);
              currentUserFirestoreData = userData;
            } else {
              // Update user document with latest data if it exists
              const userData = userDoc.data();
              // Ensure we're using high quality images
              if (userData.photoURL) {
                userData.photoURL = getHighQualityPhotoURL(userData.photoURL) || userData.photoURL;
              }
              currentUserFirestoreData = userData;
              
              // Update Firestore with latest auth data
              const updatedData = {
                uid: user.uid,
                name: user.displayName || user.email || `User${Math.floor(Math.random() * 10000)}`,
                displayName: user.displayName,
                email: user.email || '',
                photoURL: getHighQualityPhotoURL(user.photoURL) || user.photoURL || '', // Keep original if processing fails
                lastLogin: new Date()
              };
              
              await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
            }
          } catch (error) {
            console.error('Firestore error in initAuth:', error);
            // Continue with authentication even if Firestore fails
          }
        }
        
        resolve(user);
      } else {
        // No user is signed in
        currentUser = null;
        currentUserFirestoreData = null;
        resolve(null);
      }
      
      // Unsubscribe after first call
      unsubscribe();
    });
  });
};

// Function to sign in with Google
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    
    // Only interact with Firestore if it's available
    if (db) {
      try {
        // Create or update user document in Firestore
        const userData = {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email || `User${currentUser.uid.substring(0, 5)}`,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: getHighQualityPhotoURL(currentUser.photoURL) || currentUser.photoURL || '', // Keep original if processing fails
          lastLogin: new Date()
        };
        
        await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
        currentUserFirestoreData = userData;
      } catch (error) {
        console.error('Firestore error in signInWithGoogle:', error);
        // Continue with authentication even if Firestore fails
      }
    }
    
    return currentUser;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

// Function to sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    currentUser = null;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Function to get current user - returns combined auth and Firestore data
export const getCurrentUser = () => {
  if (!currentUser) {
    return null;
  }
  
  // If we have Firestore data, combine it with auth data
  if (currentUserFirestoreData) {
    return {
      ...currentUser,
      ...currentUserFirestoreData
    };
  }
  
  // Otherwise return just the auth user
  return currentUser;
};

// Function to update user profile
export const updateUserProfile = async (displayName) => {
  if (currentUser) {
    // Update Firebase Authentication profile
    try {
      await updateProfile(currentUser, {
        displayName: displayName
      });
    } catch (error) {
      console.error('Profile update error:', error);
    }
    
    // Only interact with Firestore if it's available
    if (db) {
      try {
        // Update user document in Firestore
        await setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          name: displayName,
          displayName: displayName,
          updatedAt: new Date()
        }, { merge: true });
      } catch (error) {
        console.error('Firestore error in updateUserProfile:', error);
      }
    }
    
    // Update local user object
    currentUser.displayName = displayName;
  }
};

// Function to send a friend request
export const sendFriendRequest = async (friendEmail) => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Find the user with the provided email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', friendEmail));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('User with this email not found');
    }
    
    const friendDoc = querySnapshot.docs[0];
    const friendData = friendDoc.data();
    
    // Add friend request to the recipient's friendRequests array
    await updateDoc(doc(db, 'users', friendData.uid), {
      friendRequests: arrayUnion({
        from: currentUser.uid,
        fromEmail: currentUser.email,
        fromName: currentUser.displayName,
        timestamp: new Date().toISOString()
      })
    });
    
    // Add notification to the requester about sending the request
    const notificationData = {
      type: 'friend_request_sent',
      message: `You sent a friend request to ${friendData.name || friendData.displayName || friendData.email}`,
      to: friendData.uid,
      toName: friendData.name || friendData.displayName || friendData.email,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the current user's document first
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData);
      
      // Update the document with the new notifications array
      await updateDoc(userDocRef, {
        notifications: notifications
      });
    }
    
    return friendData;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// Function to subscribe to friend requests
export const subscribeToFriendRequests = (callback) => {
  if (!currentUser || !db) {
    callback([]);
    return () => {};
  }

  try {
    // Get the current user's document to get their friend requests
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    return onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const friendRequests = userData.friendRequests || [];
        callback(friendRequests);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Friend requests subscription error:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Friend requests subscription setup error:', error);
    callback([]);
    return () => {};
  }
};

// Function to accept a friend request
export const acceptFriendRequest = async (request) => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Add the requester to the current user's friends list
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friends: arrayUnion(request.from),
      friendRequests: arrayRemove(request)
    });

    // Add the current user to the requester's friends list
    await updateDoc(doc(db, 'users', request.from), {
      friends: arrayUnion(currentUser.uid)
    });
    
    // Add notification to the current user (Himani) about accepting the request
    const notificationData1 = {
      type: 'friend_request_accepted_self',
      message: `You accepted ${request.fromName || request.fromEmail}'s friend request`,
      from: request.from,
      fromName: request.fromName || request.fromEmail,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the current user's document first
    const currentUserDocRef = doc(db, 'users', currentUser.uid);
    const currentUserDoc = await getDoc(currentUserDocRef);
    
    if (currentUserDoc.exists()) {
      const userData = currentUserDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData1);
      
      // Update the document with the new notifications array
      await updateDoc(currentUserDocRef, {
        notifications: notifications
      });
    }
    
    // Add notification to the requester
    const notificationData2 = {
      type: 'friend_request_accepted',
      message: `${currentUser.displayName || currentUser.email} accepted your friend request`,
      from: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the requester's document first
    const requesterDocRef = doc(db, 'users', request.from);
    const requesterDoc = await getDoc(requesterDocRef);
    
    if (requesterDoc.exists()) {
      const userData = requesterDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData2);
      
      // Update the document with the new notifications array
      await updateDoc(requesterDocRef, {
        notifications: notifications
      });
    }

    return true;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

// Function to decline a friend request
export const declineFriendRequest = async (request) => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Remove the request from the current user's friendRequests array
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friendRequests: arrayRemove(request)
    });
    
    // Add notification to the current user (Himani) about declining the request
    const notificationData1 = {
      type: 'friend_request_declined_self',
      message: `You declined ${request.fromName || request.fromEmail}'s friend request`,
      from: request.from,
      fromName: request.fromName || request.fromEmail,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the current user's document first
    const currentUserDocRef = doc(db, 'users', currentUser.uid);
    const currentUserDoc = await getDoc(currentUserDocRef);
    
    if (currentUserDoc.exists()) {
      const userData = currentUserDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData1);
      
      // Update the document with the new notifications array
      await updateDoc(currentUserDocRef, {
        notifications: notifications
      });
    }
    
    // Add notification to the requester
    const notificationData2 = {
      type: 'friend_request_declined',
      message: `${currentUser.displayName || currentUser.email} declined your friend request`,
      from: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the requester's document first
    const requesterDocRef = doc(db, 'users', request.from);
    const requesterDoc = await getDoc(requesterDocRef);
    
    if (requesterDoc.exists()) {
      const userData = requesterDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData2);
      
      // Update the document with the new notifications array
      await updateDoc(requesterDocRef, {
        notifications: notifications
      });
    }

    return true;
  } catch (error) {
    console.error('Error declining friend request:', error);
    throw error;
  }
};

// Function to unfriend a user
export const unfriendUser = async (friendUid) => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Get friend's data for notification
    const friendDoc = await getDoc(doc(db, 'users', friendUid));
    const friendData = friendDoc.exists() ? friendDoc.data() : null;
    const friendName = friendData?.displayName || friendData?.name || friendData?.email || `User${friendUid.substring(0, 5)}`;

    // Remove the friend from the current user's friends list
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friends: arrayRemove(friendUid)
    });

    // Remove the current user from the friend's friends list
    await updateDoc(doc(db, 'users', friendUid), {
      friends: arrayRemove(currentUser.uid)
    });
    
    // Add notification to the current user about unfriending
    const notificationData1 = {
      type: 'unfriended_user',
      message: `You unfriended ${friendName}`,
      friendUid: friendUid,
      friendName: friendName,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the current user's document first
    const currentUserDocRef = doc(db, 'users', currentUser.uid);
    const currentUserDoc = await getDoc(currentUserDocRef);
    
    if (currentUserDoc.exists()) {
      const userData = currentUserDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData1);
      
      // Update the document with the new notifications array
      await updateDoc(currentUserDocRef, {
        notifications: notifications
      });
    }

    // Add notification to the unfriended user
    const notificationData2 = {
      type: 'unfriended_by_user',
      message: `${currentUser.displayName || currentUser.email} unfriended you`,
      from: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get the unfriended user's document first
    const unfriendedUserDocRef = doc(db, 'users', friendUid);
    const unfriendedUserDoc = await getDoc(unfriendedUserDocRef);
    
    if (unfriendedUserDoc.exists()) {
      const userData = unfriendedUserDoc.data();
      const notifications = userData.notifications || [];
      
      // Add the new notification to the array
      notifications.push(notificationData2);
      
      // Update the document with the new notifications array
      await updateDoc(unfriendedUserDocRef, {
        notifications: notifications
      });
    }

    return true;
  } catch (error) {
    console.error('Error unfriending user:', error);
    throw error;
  }
};

// Function to subscribe to notifications
export const subscribeToNotifications = (callback) => {
  if (!currentUser || !db) {
    callback([]);
    return () => {};
  }

  try {
    // Get the current user's document to get their notifications
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    return onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const notifications = userData.notifications || [];
        
        // Sort notifications by timestamp (newest first)
        const sortedNotifications = notifications.sort((a, b) => {
          // Handle cases where timestamp might be a string or Date object
          const aTime = new Date(a.timestamp);
          const bTime = new Date(b.timestamp);
          return bTime - aTime;
        });
        callback(sortedNotifications);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Notifications subscription error:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Notifications subscription setup error:', error);
    callback([]);
    return () => {};
  }
};

// Function to mark a notification as read
export const markNotificationAsRead = async (notification) => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Get the current user's document
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const notifications = userData.notifications || [];
      
      // Find the notification to update by comparing relevant fields
      const updatedNotifications = notifications.map(notif => {
        // Compare the notification by type, message, and timestamp
        if (notif.type === notification.type && 
            notif.message === notification.message &&
            ((notif.timestamp && notification.timestamp && 
              notif.timestamp.toDate && notification.timestamp.toDate &&
              notif.timestamp.toDate().getTime() === notification.timestamp.toDate().getTime()) ||
             (notif.timestamp && notification.timestamp &&
              notif.timestamp.getTime && notification.timestamp.getTime &&
              notif.timestamp.getTime() === notification.timestamp.getTime()))) {
          return { ...notif, read: true };
        }
        return notif;
      });
      
      // Update the document with the modified notifications array
      await updateDoc(userDocRef, {
        notifications: updatedNotifications
      });
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Function to clear all notifications
export const clearAllNotifications = async () => {
  if (!currentUser || !db) {
    throw new Error('User not authenticated or database not available');
  }

  try {
    // Clear all notifications
    await updateDoc(doc(db, 'users', currentUser.uid), {
      notifications: []
    });

    return true;
  } catch (error) {
    console.error('Error clearing notifications:', error);
    throw error;
  }
};

// Function to subscribe to friends list only
export const subscribeToFriends = (callback) => {
  if (!currentUser || !db) {
    callback([]);
    return () => {};
  }

  try {
    // Get the current user's document to get their friends list
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    return onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const friendIds = userData.friends || [];
        
        // If no friends, return empty array
        if (friendIds.length === 0) {
          callback([]);
          return;
        }
        
        // Subscribe to friends' data
        const friendsRef = collection(db, 'users');
        const q = query(friendsRef, where('uid', 'in', friendIds));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const friends = [];
          querySnapshot.forEach((doc) => {
            const friendData = doc.data();
            // Ensure we're using high quality images
            if (friendData.photoURL) {
              friendData.photoURL = getHighQualityPhotoURL(friendData.photoURL);
            }
            friends.push({ id: doc.id, ...friendData });
          });
          callback(friends);
        }, (error) => {
          console.error('Friends subscription error:', error);
          callback([]);
        });
        
        return unsubscribe;
      } else {
        callback([]);
        return () => {};
      }
    }, (error) => {
      console.error('User document subscription error:', error);
      callback([]);
      return () => {};
    });
  } catch (error) {
    console.error('Friends subscription setup error:', error);
    callback([]);
    return () => {};
  }
};

// Function to subscribe to users list (all users for demo purposes)
export const subscribeToUsers = (callback) => {
  // Only subscribe to Firestore if it's available
  if (db) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef);
      
      return onSnapshot(q, (querySnapshot) => {
        const users = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Ensure we're using high quality images
          if (userData.photoURL) {
            userData.photoURL = getHighQualityPhotoURL(userData.photoURL);
          }
          users.push({ id: doc.id, ...userData });
        });
        
        callback(users);
      }, (error) => {
        console.error('Firestore subscription error:', error);
        // Return empty array on error but don't break the app
        callback([]); // Return empty array on error
      });
    } catch (error) {
      console.error('Firestore subscription setup error:', error);
      callback([]); // Return empty array on error
      return () => {}; // Return empty unsubscribe function
    }
  } else {
    console.warn('Firestore not available, returning empty user list');
    callback([]); // Return empty array if Firestore is not available
    return () => {}; // Return empty unsubscribe function
  }
};

// Function to get user by ID
export const getUserById = async (uid) => {
  // Only interact with Firestore if it's available
  if (db) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Ensure we're using high quality images
        if (userData.photoURL) {
          userData.photoURL = getHighQualityPhotoURL(userData.photoURL);
        }
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Firestore error in getUserById:', error);
      return null;
    }
  } else {
    console.warn('Firestore not available, returning null');
    return null;
  }
};