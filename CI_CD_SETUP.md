# CI/CD Setup Documentation

This document explains how to set up Continuous Integration and Continuous Deployment for FlashChat.

## Prerequisites

1. GitHub repository
2. Vercel account for frontend deployment
3. Railway account for backend deployment

## GitHub Actions Workflows

Two workflows are configured:

1. `.github/workflows/frontend.yml` - Frontend CI/CD
2. `.github/workflows/backend.yml` - Backend CI/CD

## Environment Variables

### Frontend (Vercel)
Set these environment variables in your Vercel project settings:

- `VITE_BACKEND_URL` - The URL of your deployed backend
- `VITE_FCM_VAPID_KEY` - Firebase Cloud Messaging VAPID key
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket

### Backend (Railway)
Set these environment variables in your Railway project settings:

- `FIREBASE_API_KEY` - Firebase API key
- `FIREBASE_APP_ID` - Firebase app ID
- `FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `FIREBASE_MEASUREMENT_ID` - Firebase measurement ID
- `FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key file
- Any other Firebase configuration variables

## GitHub Secrets

Set these secrets in your GitHub repository settings:

### For Frontend Deployment (Vercel)
- `VERCEL_TOKEN` - Vercel token for authentication
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### For Backend Deployment (Railway)
- `RAILWAY_TOKEN` - Railway token for authentication
- `RAILWAY_SERVICE_ID` - Railway service ID

## Deployment Process

### Frontend
1. On push to `main` branch: Build and deploy to production
2. On pull request to `main` or `dev`: Build and deploy to preview

### Backend
1. On push to `main` branch: Build, test, and deploy to Railway production
2. On pull request: Build and test only

## Configuration Files

- `vercel.json` - Vercel deployment configuration
- `railway.json` - Railway deployment configuration
- `.github/workflows/frontend.yml` - Frontend CI/CD workflow
- `.github/workflows/backend.yml` - Backend CI/CD workflow