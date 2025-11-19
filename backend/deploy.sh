#!/bin/bash

# Deploy to Railway
echo "Deploying to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null
then
    echo "Railway CLI could not be found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Deploy
railway up

echo "Deployment complete!"
echo "Remember to update the frontend with your new Railway URL:"
echo "1. Get your URL from the Railway dashboard"
echo "2. Update VITE_BACKEND_URL in your Vercel environment variables"
echo "3. Redeploy your frontend"