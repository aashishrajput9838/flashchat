#!/usr/bin/env node

// Script to generate or validate VAPID keys for Firebase Cloud Messaging
// This script helps with FCM setup by providing utilities for VAPID key management

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate a new VAPID key pair
 * Note: For Firebase Cloud Messaging, you should use the key from Firebase Console
 * This is just for reference/testing purposes
 */
function generateVapidKeyPair() {
  try {
    // Generate a random 65-byte key (Firebase typically uses 65-byte keys)
    const privateKey = crypto.randomBytes(32);
    const publicKey = crypto.randomBytes(32);
    
    console.log('=== Generated VAPID Key Pair (for reference only) ===');
    console.log('Private Key (Base64):', privateKey.toString('base64'));
    console.log('Public Key (Base64):', publicKey.toString('base64'));
    console.log('\nNote: For Firebase Cloud Messaging, use the key from Firebase Console');
    console.log('Go to Firebase Console > Project Settings > Cloud Messaging > Web Push certificates');
    
    return {
      privateKey: privateKey.toString('base64'),
      publicKey: publicKey.toString('base64')
    };
  } catch (error) {
    console.error('Error generating VAPID key pair:', error.message);
    return null;
  }
}

/**
 * Validate a VAPID key format
 * @param {string} vapidKey - VAPID key to validate
 * @returns {Object} Validation result
 */
function validateVapidKey(vapidKey) {
  if (!vapidKey) {
    return {
      isValid: false,
      message: 'VAPID key is missing'
    };
  }
  
  if (typeof vapidKey !== 'string') {
    return {
      isValid: false,
      message: 'VAPID key must be a string'
    };
  }
  
  // Check length (Firebase VAPID keys are typically 64+ characters)
  if (vapidKey.length < 64) {
    return {
      isValid: false,
      message: `VAPID key is too short (${vapidKey.length} characters). Should be at least 64 characters.`
    };
  }
  
  // Check if it looks like a base64 string
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(vapidKey)) {
    return {
      isValid: false,
      message: 'VAPID key does not appear to be a valid base64 string'
    };
  }
  
  return {
    isValid: true,
    message: 'VAPID key format appears valid'
  };
}

/**
 * Check if .env file exists and has VAPID key
 */
function checkEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('.env file not found. Creating a template...');
    const template = `# Firebase Cloud Messaging VAPID Key
VITE_FCM_VAPID_KEY=your_vapid_key_here

# Other Firebase configuration
# VITE_FIREBASE_API_KEY=your_api_key
# VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
# VITE_FIREBASE_PROJECT_ID=your_project_id
# VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
# VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
# VITE_FIREBASE_APP_ID=your_app_id
`;
    fs.writeFileSync(envPath, template);
    console.log('Created .env file template. Please update with your actual values.');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasVapidKey = envContent.includes('VITE_FCM_VAPID_KEY');
  
  if (!hasVapidKey) {
    console.log('VITE_FCM_VAPID_KEY not found in .env file.');
    return false;
  }
  
  // Extract the VAPID key
  const vapidKeyMatch = envContent.match(/VITE_FCM_VAPID_KEY=(.+)/);
  if (vapidKeyMatch && vapidKeyMatch[1]) {
    const vapidKey = vapidKeyMatch[1].trim();
    const validation = validateVapidKey(vapidKey);
    console.log(`VAPID Key Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`Validation Message: ${validation.message}`);
    return validation.isValid;
  }
  
  return false;
}

/**
 * Get instructions for getting VAPID key from Firebase Console
 */
function getFirebaseInstructions() {
  const instructions = `
=== How to Get Your VAPID Key from Firebase Console ===

1. Go to the Firebase Console: https://console.firebase.google.com/
2. Select your project
3. Click the gear icon (Project Settings)
4. Go to the "Cloud Messaging" tab
5. In the "Web configuration" section, find "Web Push certificates"
6. Click "Generate Key Pair" if you don't have one
7. Copy the "Key pair" value (this is your VAPID key)
8. Add it to your .env file as:
   VITE_FCM_VAPID_KEY=your_copied_key_here

Note: The key should be a long base64 string (typically 88+ characters)
`;
  
  console.log(instructions);
}

// Main execution
function main() {
  console.log('=== FCM VAPID Key Helper ===\n');
  
  // Check environment file
  console.log('1. Checking .env file...');
  checkEnvFile();
  
  // Show Firebase instructions
  console.log('\n2. Firebase Console Instructions:');
  getFirebaseInstructions();
  
  // Offer to generate a test key (for reference only)
  console.log('\n3. Generate Test Key Pair (for reference only):');
  console.log('   Note: This is NOT for production use. Use Firebase Console key instead.\n');
  
  const args = process.argv.slice(2);
  if (args.includes('--generate') || args.includes('-g')) {
    generateVapidKeyPair();
  } else {
    console.log('   Run with --generate or -g flag to generate a test key pair');
  }
  
  console.log('\n=== End FCM VAPID Key Helper ===');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateVapidKeyPair,
  validateVapidKey,
  checkEnvFile,
  getFirebaseInstructions
};