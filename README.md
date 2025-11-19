<!-- Testing CI/CD Pipeline --> - Test 2
# FlashChat

![FlashChat Interface](https://github.com/user-attachments/assets/fd914aa9-c7fd-44ce-a876-d723ab745085)

FlashChat is a modern real-time communication platform built with React, Firebase, and WebRTC. It provides instant messaging and audio/video calling capabilities with a focus on user experience and performance.

## Features

- 🔐 **Google Authentication**: Secure sign-in with Google accounts
- 💬 **Real-time Messaging**: Instant messaging with real-time updates
- 📞 **Audio/Video Calling**: High-quality WebRTC-based calling
- 👥 **Friend Management**: Add friends, send requests, and manage connections
- 🟢 **Online Status**: See when your friends are online
- 🌙 **Dark/Light Theme**: Toggle between dark and light modes
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- 🔍 **User Search**: Find and connect with other users
- 🔔 **Push Notifications**: Receive browser notifications for messages and calls even when the app is closed

## FlashChat Codebase Overview

### Architecture
FlashChat is a full-stack real-time chat and video calling application built with:
- **Frontend**: React 18+, Vite, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO Server
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication (Google Sign-in)
- **Real-time Communication**: WebRTC for video calls, Socket.IO for signaling
- **Push Notifications**: Firebase Cloud Messaging (FCM)

### Key Features

#### 1. User Management
- Google authentication with userService.js
- Friend management (add, accept, decline, unfriend)
- Online status tracking with privacy controls
- User profiles with high-quality avatars

#### 2. Chat System
- Real-time messaging with Firestore
- File sharing capabilities
- Conversation history
- Message notifications

#### 3. Video Calling
- WebRTC-based video calls with STUN/TURN servers
- Call signaling through Firestore and Socket.IO
- Screen sharing functionality
- Call notifications via FCM

#### 4. Notifications
- Push notifications using Firebase Cloud Messaging
- In-app notifications with Web Notifications API
- Notification preferences management
- Service worker for background message handling

### Project Structure
```
.
├── src/                    # Frontend source code
│   ├── features/          # Feature modules
│   │   ├── auth/          # Authentication components
│   │   ├── call/          # Video call components and services
│   │   ├── chat/          # Chat components and services
│   │   ├── notifications/ # Notification components and services
│   │   └── user/          # User components and services
│   ├── shared/            # Shared components and utilities
│   ├── config/            # Firebase configuration
│   └── App.jsx            # Main application component
├── backend/               # Backend server
│   ├── index.js           # Express server with Socket.IO
│   └── uploads/           # File upload storage
├── public/                # Static assets
└── functions/             # Firebase functions (not actively used)
```

### Technical Highlights

#### Real-time Communication
- **WebRTC Video Calls**: Uses Firebase for signaling and Socket.IO for real-time events
- **Socket.IO**: Handles user presence, call initiation, and call status updates
- **Firestore**: Stores chat messages, user data, and call metadata

#### Security & Privacy
- **Rate Limiting**: Implemented in both frontend and backend
- **Online Status Privacy**: Users can control who sees their online status
- **Secure File Uploads**: Multer middleware with file size limits

#### Responsive Design
- **Mobile-First**: Optimized for mobile, tablet, and desktop
- **Safe Area Insets**: Support for notched devices
- **Flexible Layouts**: Adapts to different screen sizes and orientations

#### Performance Optimizations
- **Lazy Loading**: Components loaded on demand
- **Efficient Queries**: Firestore queries optimized with proper indexing
- **Caching**: Service workers for offline support and faster loading

### Key Components

#### Frontend
- **App.jsx**: Main application with responsive layout
- **VideoCall Component**: WebRTC video calling interface
- **Chat Components**: Conversation list and chat thread
- **Notification System**: Push and in-app notifications

#### Backend
- **Express Server**: API endpoints and static file serving
- **Socket.IO Server**: Real-time communication for calls
- **Firebase Integration**: Firestore and FCM handling

#### Services
- **Call Service**: WebRTC signaling through Firestore
- **Chat Service**: Message handling with Firestore
- **User Service**: Authentication and user management
- **Notification Service**: Push notifications via FCM

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/flashchat.git
   cd flashchat
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com/
   - Register your app and get the configuration
   - Update `src/config/firebase.js` with your Firebase config
   - Enable Firebase Cloud Messaging in the Firebase Console
   - Generate a Web Push Certificate in Firebase Cloud Messaging settings

4. Configure FCM (Firebase Cloud Messaging):
   - Get your VAPID key from Firebase Console > Project Settings > Cloud Messaging
   - Add it to your `.env` file as `VITE_FCM_VAPID_KEY=your_vapid_key_here`

5. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open your browser to http://localhost:5173

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run fcm:debug` - Run FCM debug utility
- `npm run fcm:generate` - Generate test VAPID key pair
- `npm run setup:env` - Interactive environment setup
- `npm run setup:env:create` - Create .env file template
- `npm run setup:env:help` - Show environment setup help

## Documentation

For detailed documentation, please see:

- [Architecture](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Coding Standards](docs/coding-standards.md)
- [Testing Guide](docs/testing.md)
- [Deployment Guide](docs/deployment.md)
- [Component Documentation](docs/)
  - [Chat Service](docs/chat-service.md)
  - [User Service](docs/user-service.md)
  - [Call Service](docs/call-service.md)
  - [useCall Hook](docs/use-call-hook.md)
  - [useChat Hook](docs/use-chat-hook.md)
  - [ConversationList Component](docs/conversation-list-component.md)
- [FCM Fixes Documentation](docs/fcm-fixes.md)
- [FCM Setup Guide](FCM_SETUP.md)
- [CI/CD Setup Guide](CI_CD_SETUP.md)

## Testing

FlashChat includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test src/features/chat/hooks/__tests__/useChat.test.js
```

### Testing Notifications

To test the notification system:

1. Ensure you have granted notification permissions in the browser
2. Run the test notification script:
   ```bash
   node test-notification.js
   ```
3. Check that you receive a notification in your browser

### Testing FCM

To test Firebase Cloud Messaging:

1. Use the FCM test page: Open `fcm-test.html` in your browser
2. Run the debug script: `npm run fcm:debug`
3. Check the browser console for FCM-related messages
4. Verify that `window.fcmToken` is populated

## Firebase Cloud Messaging (FCM) Setup

For push notifications to work properly, you need to configure FCM:

1. Get your VAPID key from Firebase Console:
   - Go to Project Settings > Cloud Messaging
   - Copy the Web Push certificate key pair

2. Add it to your `.env` file:
   ```bash
   VITE_FCM_VAPID_KEY=your_vapid_key_here
   ```

3. Verify the setup by running the FCM test script:
   ```bash
   npm run fcm:debug
   ```

### FCM Debugging

If you encounter issues with FCM:

1. Check the browser console for specific error messages
2. Run the interactive setup: `npm run setup:env`
3. Use the FCM test page: Open `public/fcm-test.html` in your browser
4. Verify your VAPID key in the Firebase Console

## CI/CD Setup

This project includes GitHub Actions workflows for continuous integration and deployment:

### Prerequisites
1. GitHub repository
2. Vercel account for frontend deployment
3. Railway account for backend deployment

### Configuration
1. Set up GitHub secrets for Vercel and Railway tokens
2. Configure environment variables in Vercel and Railway dashboards
3. Push to `main` branch to trigger production deployment

For detailed setup instructions, see [CI/CD Setup Guide](CI_CD_SETUP.md).

## Deployment

To deploy to Firebase Hosting:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase project:
   ```bash
   firebase init
   ```

4. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)
