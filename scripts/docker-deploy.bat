@echo off
setlocal

echo 🚀 Starting FlashChat Docker Deployment

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not available. Please ensure Docker Desktop is properly installed.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "..\.env" (
    echo ⚠️  .env file not found. Creating template...
    copy "..\.env.example" "..\.env" >nul
    echo 📝 Please update the ..\.env file with your Firebase configuration and then run this script again.
    pause
    exit /b 1
)

REM Build and start services
echo 🏗️  Building Docker images...
docker-compose build

echo 🚢 Starting services...
docker-compose up -d

echo ✅ Deployment complete!
echo 📱 Frontend available at: http://localhost
echo ⚙️  Backend API available at: http://localhost:8080
echo 📋 To view logs: docker-compose logs -f
echo 🛑 To stop services: docker-compose down

pause