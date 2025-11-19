@echo off
echo Deploying to Railway...

REM Check if railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Railway CLI could not be found. Please install it first:
    echo npm install -g @railway/cli
    exit /b 1
)

REM Deploy
railway up

echo Deployment complete!
echo Remember to update the frontend with your new Railway URL:
echo 1. Get your URL from the Railway dashboard
echo 2. Update VITE_BACKEND_URL in your Vercel environment variables
echo 3. Redeploy your frontend