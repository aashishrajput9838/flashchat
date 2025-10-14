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
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';

// Function to get higher quality Google profile image
const getHighQualityPhotoURL = (photoURL) => {
  if (!photoURL) return null;
  
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
  
  return photoURL;
};

// Current user state
let currentUser = null;

// Function to initialize authentication
export const initAuth = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
                photoURL: getHighQualityPhotoURL(user.photoURL) || '',
                createdAt: new Date()
              };
              
              await setDoc(doc(db, 'users', user.uid), userData);
            } else {
              // Update user document with latest data if it exists
              const userData = {
                uid: user.uid,
                name: user.displayName || user.email || `User${Math.floor(Math.random() * 10000)}`,
                displayName: user.displayName,
                email: user.email || '',
                photoURL: getHighQualityPhotoURL(user.photoURL) || '',
                lastLogin: new Date()
              };
              
              await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
            }
          } catch (error) {
            console.error('Firestore error in initAuth:', error);
            // Continue with authentication even if Firestore fails
          }
        }
        
        resolve(user);
      } else {
        // No user is signed in
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
          photoURL: getHighQualityPhotoURL(currentUser.photoURL),
          lastLogin: new Date()
        };
        
        await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
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

// Function to get current user
export const getCurrentUser = () => {
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

// Function to subscribe to users list
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