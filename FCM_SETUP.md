# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you set up Firebase Cloud Messaging for push notifications in FlashChat.

## Prerequisites

1. Firebase project created
2. Firebase project settings configured
3. VAPID key generated

## Getting Your VAPID Key

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** (gear icon)
4. Go to the **Cloud Messaging** tab
5. In the **Web configuration** section, click **Generate Key Pair**
6. Copy the generated **Public Key** (this is your VAPID key)

## Environment Configuration

Add the following to your `.env` file:

```bash
VITE_FCM_VAPID_KEY=your_vapid_key_here
```

Replace `your_vapid_key_here` with the VAPID key you generated.

## Common Issues and Solutions

### 1. "The provided applicationServerKey is not valid" Error

This error typically occurs when:

- The VAPID key is missing or incorrect
- The VAPID key format is invalid
- The service worker is not properly registered

**Solution:**
1. Verify your VAPID key in the `.env` file
2. Ensure the key is the correct public key from Firebase
3. Check that the service worker is registered properly

### 2. Service Worker Registration Issues

**Solution:**
1. Check that `firebase-messaging-sw.js` exists in the `public` directory
2. Verify the file contents match the Firebase requirements
3. Ensure the service worker path is correct in `main.jsx`

### 3. Token Generation Failures

**Solution:**
1. Check browser console for specific error messages
2. Verify notification permissions are granted
3. Ensure the VAPID key is correctly formatted

## Testing FCM

1. Use the browser console to test:
   ```javascript
   window.getFcmToken()
   ```

2. Check that `window.fcmToken` is populated after calling the function

3. Use the test notification endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/test-notification \
     -H "Content-Type: application/json" \
     -d '{"token": "YOUR_FCM_TOKEN", "title": "Test", "body": "Test notification"}'
   ```

## Debugging Tips

1. Check browser console for detailed error messages
2. Verify service worker registration status
3. Ensure all environment variables are set correctly
4. Test with different browsers as some may have different notification handling

## Need Help?

If you continue to experience issues:

1. Check the browser console for specific error messages
2. Verify your Firebase project settings
3. Ensure your VAPID key matches exactly what's shown in the Firebase Console
4. Check that your service worker file is correctly configured