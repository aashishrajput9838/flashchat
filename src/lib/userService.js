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
  updateDoc
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
        timestamp: new Date()
      })
    });
    
    return friendData;
  } catch (error) {
    console.error('Error sending friend request:', error);
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