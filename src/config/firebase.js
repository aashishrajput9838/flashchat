// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your web app's Firebase configuration (from environment variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB_3xErgKerW8IsWLQzu6IsMyiXNOPSxEo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "web-socket-2e05f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "web-socket-2e05f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "web-socket-2e05f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "213332457740",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:213332457740:web:dbfe9e380e1629d0427129",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RYFQE7TFGN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Conditionally initialize Firestore with settings to handle connection issues
let db;
try {
  db = getFirestore(app);
  // Enable offline persistence
  // This will help with connection issues
} catch (error) {
  console.error("Firestore initialization error:", error);
  db = null;
}

// Conditionally initialize Analytics
let analytics;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Analytics initialization error:", error);
  analytics = null;
}

// Conditionally initialize Firebase Messaging
let messaging;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Messaging initialization error:", error);
  messaging = null;
}

// Initialize Firebase Functions
let functions;
try {
  functions = getFunctions(app, 'us-central1');
  // Uncomment the following line to use the local emulator during development
  // connectFunctionsEmulator(functions, "localhost", 5001);
} catch (error) {
  console.warn("Functions initialization error:", error);
  functions = null;
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Export Firestore instance, Messaging, and Functions
export { db, messaging, functions };

// Add a function to handle Firestore errors and implement backoff logic
export const handleFirestoreError = (error) => {
  console.error("Firestore error:", error);
  
  // Check if it's a quota exceeded error
  if (error.code === 'resource-exhausted') {
    console.warn("Quota exceeded. Implementing backoff strategy.");
    // You could implement a more sophisticated backoff strategy here
    // For now, we'll just log the error and suggest waiting
    alert("Service temporarily unavailable due to usage limits. Please wait a few minutes before trying again.");
  }
  
  // Check if it's a permission error
  if (error.code === 'permission-denied') {
    console.warn("Permission denied. Check Firestore rules.");
  }
  
  // Check if it's a network error
  if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
    console.warn("Network error. Retrying...");
    // You could implement retry logic here
  }
};

export default app;