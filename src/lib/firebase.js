// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB_3xErgKerW8IsWLQzu6IsMyiXNOPSxEo",
  authDomain: "web-socket-2e05f.firebaseapp.com",
  projectId: "web-socket-2e05f",
  storageBucket: "web-socket-2e05f.firebasestorage.app",
  messagingSenderId: "213332457740",
  appId: "1:213332457740:web:dbfe9e380e1629d0427129",
  measurementId: "G-RYFQE7TFGN"
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

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Export Firestore instance
export { db };

export default app;