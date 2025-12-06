#!/bin/bash

# Docker deployment script for FlashChat

echo "🚀 Starting FlashChat Docker Deployment"

# Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating template..."
    cp .env.example .env
    echo "📝 Please update the .env file with your Firebase configuration and then run this script again."
    exit 1
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build

echo "🚢 Starting services..."
docker-compose up -d

echo "✅ Deployment complete!"
echo "📱 Frontend available at: http://localhost"
echo "⚙️  Backend API available at: http://localhost:8080"
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop services: docker-compose down"