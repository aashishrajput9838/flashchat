# FlashChat Backend Server

This is the backend server for FlashChat, handling WebSockets for real-time communication and FCM notifications.

## Deployment to Railway

1. Create a Railway account at [railway.app](https://railway.app)

2. Install the Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

3. Login to Railway:
   ```bash
   railway login
   ```

4. Initialize a new Railway project:
   ```bash
   railway init
   ```

5. Deploy the backend:
   ```bash
   railway up
   ```

6. Add environment variables in the Railway dashboard:
   - `GOOGLE_APPLICATION_CREDENTIALS` - Path to your Firebase service account key
   - Any other required environment variables

7. Get your deployed URL from the Railway dashboard and update the frontend notification service.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

The server will run on port 3001 by default, or the port specified by the `PORT` environment variable.