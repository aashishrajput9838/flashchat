# FlashChat Notification System

## Overview

The FlashChat notification system provides real-time notifications to users across all major platforms and browsers. It supports both foreground and background notifications, with customizable settings and priority levels.

## Architecture

The notification system consists of the following components:

1. **Frontend Service** - Manages notification permissions, settings, and sending
2. **Service Worker** - Handles background notifications and user interactions
3. **Backend Server** - Processes notification requests and sends them via FCM
4. **Firebase Cloud Messaging** - Delivers notifications to devices

## Features

### Platform Compatibility
- Works across all major browsers (Chrome, Firefox, Safari, Edge)
- Optimized for both Android and iOS devices
- Supports desktop and mobile web browsers

### Notification Types
1. **Direct Messages** - Private messages between users
2. **Mentions** - When a user is mentioned in a group chat
3. **Group Messages** - Messages in group conversations
4. **Calls** - Incoming audio/video calls
5. **System** - System-level notifications

### Priority System
- **High Priority** - For direct messages and calls (immediate delivery)
- **Normal Priority** - For group messages and mentions
- **Low Priority** - For non-urgent system notifications

### Background Processing
- Uses Service Workers for background notification handling
- Notifications delivered even when app is closed or in background
- Queued notifications delivered when browser is reopened

### User Permissions
- Requests notification permissions on first app launch
- Provides clear instructions for enabling notifications
- Respects user privacy preferences

### Customizable Settings
- Users can enable/disable specific notification types
- Sound and vibration preferences
- Priority settings for different notification types

### Error Handling & Fallbacks
- Automatic retry mechanism for failed notifications
- Fallback to email/SMS notifications (planned)
- Comprehensive error logging and monitoring

## Implementation Details

### Frontend Service

The notification service (`src/features/notifications/services/notificationService.js`) provides:

- Permission management
- Notification sending
- User settings management
- Fallback mechanisms

### Service Worker

The service worker (`public/firebase-messaging-sw.js`) handles:

- Background message reception
- Notification display customization
- User interaction handling
- Push event processing

### Backend Server

The backend server (`backend/index.js`) manages:

- FCM message sending
- Cross-platform notification configuration
- API endpoint for notification requests

## Usage

### Sending Notifications

```javascript
import { sendMessageNotification, sendCallNotification } from '@/features/notifications/services/notificationService';

// Send a message notification
await sendMessageNotification(
  recipientUserId, 
  senderName, 
  messageText, 
  messageType
);

// Send a call notification
await sendCallNotification(
  recipientUserId, 
  callerName, 
  callType
);
```

### Managing Permissions

```javascript
import { useNotifications } from '@/features/notifications/hooks/useNotifications';

const { 
  permissionStatus, 
  settings, 
  requestPermission 
} = useNotifications();

// Request notification permissions
const handleRequestPermission = async () => {
  const result = await requestPermission();
  if (result.success) {
    console.log('Notification permission granted');
  }
};
```

### Customizing Settings

Users can customize their notification preferences through the NotificationSettings component:

```jsx
import NotificationSettings from '@/features/notifications/components/NotificationSettings';

<NotificationSettings />
```

## Deployment

### Railway Deployment

1. Deploy the backend to Railway:
   ```bash
   cd backend
   railway up
   ```

2. Update the frontend with your Railway URL:
   ```javascript
   const backendUrl = 'https://your-app-name.up.railway.app';
   ```

3. Redeploy the frontend to Vercel or your preferred hosting platform.

### Environment Variables

Set the following environment variables in your Railway project:
- Firebase service account credentials
- Any other required configuration variables

## Testing

### Test Scenarios

1. **App in Foreground** - Notifications appear in-app
2. **App in Background** - System notifications appear
3. **Browser Closed** - Notifications queued and delivered when browser opens
4. **Permission Denied** - Graceful handling of denied permissions
5. **Network Issues** - Retry mechanism for failed deliveries

### Browser Testing

- Chrome (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Safari (Desktop & Mobile)
- Edge (Desktop)

## Troubleshooting

### Common Issues

1. **Notifications Not Appearing**
   - Check permission status
   - Verify FCM token is saved
   - Confirm backend URL is correct

2. **Permission Requests Not Showing**
   - Browser may have blocked permissions
   - Check browser notification settings
   - Clear site data and try again

3. **Backend Connection Issues**
   - Verify Railway deployment
   - Check CORS configuration
   - Confirm environment variables

### Debugging

Enable verbose logging by checking the browser console and backend logs for detailed information about notification processing.

## Future Enhancements

1. **Email/SMS Fallback** - Implement fallback mechanisms for critical notifications
2. **Rich Notifications** - Add images and action buttons to notifications
3. **Notification History** - Store and display notification history
4. **Do Not Disturb** - Implement quiet hours and focus modes
5. **Analytics** - Track notification engagement and delivery metrics