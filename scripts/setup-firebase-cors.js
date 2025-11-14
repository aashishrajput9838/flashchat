#!/usr/bin/env node

// Script to provide instructions for setting up Firebase Storage CORS configuration
// This script outputs instructions for manually configuring Firebase Storage to allow requests from your Vercel domain

console.log('=== Firebase Storage CORS Configuration Instructions ===\n');

console.log('To fix the CORS issues with file uploads, you need to configure CORS for Firebase Storage.\n');

console.log('Option 1: Using gsutil (Google Cloud SDK)\n');

console.log('1. Install Google Cloud SDK:');
console.log('   - Download from: https://cloud.google.com/sdk/docs/install');
console.log('   - Follow the installation instructions for your OS\n');

console.log('2. Authenticate with Google Cloud:');
console.log('   gcloud auth login\n');

console.log('3. Create a CORS configuration file (firebase-storage-cors.json):');
console.log(`   {
     "origin": [
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
     "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
     "maxAgeSeconds": 3600
   }\n`);

console.log('4. Set the CORS configuration:');
console.log('   gsutil cors set firebase-storage-cors.json gs://web-socket-2e05f.appspot.com\n');

console.log('Option 2: Using Firebase Console\n');

console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select your project (web-socket-2e05f)');
console.log('3. Go to Storage > Rules');
console.log('4. Update the rules to allow requests from your Vercel domain:');
console.log(`   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }\n`);

console.log('Note: For production apps, you should implement more specific security rules.\n');

console.log('Option 3: Contact your system administrator or Firebase project owner to set up CORS.\n');

console.log('After setting up CORS, redeploy your frontend and backend to apply the changes.');