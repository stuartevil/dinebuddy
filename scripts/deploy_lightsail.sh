#!/bin/bash
# Deploy DineBuddy to AWS Lightsail ($5/month)
# Run this script ON your Lightsail instance after SSH'ing in

set -e

echo "🚀 DineBuddy Lightsail Deployment Script"
echo "========================================"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script should be run on your Lightsail instance, not locally!"
    echo "   SSH into your Lightsail instance first:"
    echo "   ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed"
    echo "⚠️  Please log out and log back in, then run this script again"
    exit 0
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo apt update
    sudo apt install docker-compose -y
    echo "✅ Docker Compose installed"
fi

# Check if running in DineBuddy directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the DineBuddy directory"
    echo "   cd ~/DineBuddy"
    exit 1
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating .env file..."
    
    # Generate secret key
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 32)
    
    # Get instance IP
    INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "YOUR_INSTANCE_IP")
    
    cat > backend/.env << EOF
# DineBuddy Environment Configuration
# Generated on $(date)

# Environment
ENVIRONMENT=production
PROJECT_NAME=DineBuddy
API_V1_PREFIX=/api/v1

# Database (Docker)
POSTGRES_HOST=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dinebuddy_$(openssl rand -hex 8)
POSTGRES_PORT=5432
POSTGRES_DB=dinebuddy

# Security - IMPORTANT: Keep this secret!
SECRET_KEY=${SECRET_KEY}

# CORS - Update with your actual domain if you have one
CORS_ORIGINS=http://${INSTANCE_IP}:8000,http://localhost:8000

# AWS (not needed for Lightsail)
AWS_REGION=us-east-1
EOF
    
    echo "✅ Created backend/.env"
    echo "⚠️  IMPORTANT: Your database password and secret key are in backend/.env"
    echo "   Keep this file secure!"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🐳 Starting Docker containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
else
    echo "❌ Services failed to start. Checking logs..."
    docker-compose logs
    exit 1
fi

echo ""
echo "🔄 Running database migrations..."
docker-compose exec -T backend alembic upgrade head || echo "⚠️  No migrations to run yet"

echo ""
echo "🧪 Testing deployment..."

# Test health endpoint
if curl -f http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    docker-compose logs backend
    exit 1
fi

# Test database connection
if curl -f http://localhost:8000/api/v1/health/db > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Database connection issue (may need more time to start)"
fi

# Get instance IP
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "YOUR_INSTANCE_IP")

echo ""
echo "========================================"
echo "✅ Deployment Complete!"
echo "========================================"
echo ""
echo "📊 Your API is running at:"
echo "   http://${INSTANCE_IP}:8000"
echo ""
echo "📖 API Documentation:"
echo "   http://${INSTANCE_IP}:8000/api/v1/docs"
echo ""
echo "🔍 Test endpoints:"
echo "   curl http://${INSTANCE_IP}:8000/api/v1/health"
echo "   curl http://${INSTANCE_IP}:8000/api/v1/health/db"
echo ""
echo "📝 Useful commands:"
echo "   docker-compose logs -f           # View logs"
echo "   docker-compose ps                # Check status"
echo "   docker-compose restart backend   # Restart backend"
echo "   docker-compose down              # Stop all services"
echo ""
echo "⚠️  IMPORTANT: Make sure port 8000 is open in Lightsail firewall!"
echo "   Lightsail Console → Networking → Add rule: TCP port 8000"
echo ""
echo "💾 Database backup:"
echo "   docker-compose exec db pg_dump -U postgres dinebuddy > backup.sql"
echo ""
echo "🎉 Happy coding!"

