#!/usr/bin/env node

// Script to help set up the .env file for FlashChat
// This script guides users through setting up required environment variables

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default Firebase configuration template
const defaultEnvTemplate = `# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Cloud Messaging VAPID Key (REQUIRED for push notifications)
VITE_FCM_VAPID_KEY=your_vapid_key_here

# Backend URL (for API calls)
VITE_BACKEND_URL=http://localhost:3001

# Additional Configuration
`;

/**
 * Check if .env file exists
 * @returns {boolean} Whether .env file exists
 */
function envFileExists() {
  const envPath = path.join(__dirname, '..', '.env');
  return fs.existsSync(envPath);
}

/**
 * Create a new .env file with template
 */
function createEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('.env file already exists.');
    return false;
  }
  
  fs.writeFileSync(envPath, defaultEnvTemplate);
  console.log('Created .env file with template values.');
  console.log('Please update the values with your actual Firebase configuration.');
  return true;
}

/**
 * Update specific environment variable
 * @param {string} key - Environment variable key
 * @param {string} value - Environment variable value
 */
function updateEnvVariable(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('.env file does not exist. Creating...');
    createEnvFile();
  }
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if the key already exists
    const keyExists = envContent.includes(`${key}=`);
    
    if (keyExists) {
      // Update existing key
      const regex = new RegExp(`(${key}=).*`, 'g');
      envContent = envContent.replace(regex, `$1${value}`);
    } else {
      // Add new key
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`Updated ${key} in .env file.`);
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    return false;
  }
}

/**
 * Interactive setup for Firebase configuration
 */
async function interactiveSetup() {
  console.log('=== FlashChat Environment Setup ===\n');
  
  // Check if .env exists
  if (!envFileExists()) {
    console.log('No .env file found. Creating one...');
    createEnvFile();
  }
  
  console.log('Please enter your Firebase configuration values:');
  console.log('(Press Enter to skip or keep existing values)\n');
  
  // Firebase configuration questions
  const firebaseQuestions = [
    {
      key: 'VITE_FIREBASE_API_KEY',
      question: 'Firebase API Key:',
      required: true
    },
    {
      key: 'VITE_FIREBASE_AUTH_DOMAIN',
      question: 'Firebase Auth Domain (e.g., your-project.firebaseapp.com):',
      required: true
    },
    {
      key: 'VITE_FIREBASE_PROJECT_ID',
      question: 'Firebase Project ID:',
      required: true
    },
    {
      key: 'VITE_FIREBASE_STORAGE_BUCKET',
      question: 'Firebase Storage Bucket (e.g., your-project.appspot.com):',
      required: true
    },
    {
      key: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
      question: 'Firebase Messaging Sender ID:',
      required: true
    },
    {
      key: 'VITE_FIREBASE_APP_ID',
      question: 'Firebase App ID:',
      required: true
    },
    {
      key: 'VITE_FCM_VAPID_KEY',
      question: 'FCM VAPID Key (for push notifications):',
      required: true
    },
    {
      key: 'VITE_BACKEND_URL',
      question: 'Backend URL (default: http://localhost:3001):',
      required: false,
      default: 'http://localhost:3001'
    }
  ];
  
  // Process each question
  for (const question of firebaseQuestions) {
    const answer = await askQuestion(question.question);
    
    if (answer || question.default) {
      const value = answer || question.default;
      updateEnvVariable(question.key, value);
    } else if (question.required) {
      console.log(`⚠️  ${question.key} is required for proper functionality.`);
    }
  }
  
  console.log('\n=== Setup Complete ===');
  console.log('Your .env file has been updated.');
  console.log('Please verify the values are correct.');
}

/**
 * Ask a question and return a promise with the answer
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User's answer
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question + ' ', (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Display setup instructions
 */
function showInstructions() {
  const instructions = `
=== FlashChat Environment Setup Instructions ===

1. Firebase Project Setup:
   - Go to https://console.firebase.google.com/
   - Create a new project or select an existing one
   - Register your web app
   - Copy the Firebase configuration values

2. FCM VAPID Key:
   - In Firebase Console, go to Project Settings > Cloud Messaging
   - In the Web configuration section, find Web Push certificates
   - Copy the Key pair value (this is your VAPID key)

3. Environment Variables:
   - Run this script interactively: npm run setup:env
   - Or manually edit the .env file with your values

4. Required Variables:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID
   - VITE_FCM_VAPID_KEY (for push notifications)

=== End Instructions ===
`;
  
  console.log(instructions);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showInstructions();
    rl.close();
    return;
  }
  
  if (args.includes('--create') || args.includes('-c')) {
    createEnvFile();
    rl.close();
    return;
  }
  
  // Default to interactive setup
  try {
    await interactiveSetup();
  } catch (error) {
    console.error('Setup error:', error.message);
  } finally {
    rl.close();
  }
}

// Export functions for use in other scripts
module.exports = {
  envFileExists,
  createEnvFile,
  updateEnvVariable,
  interactiveSetup,
  showInstructions
};

// Run if called directly
if (require.main === module) {
  main();
}