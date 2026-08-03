# 💰 AWS Lightsail Deployment - $5/month

Deploy DineBuddy to AWS Lightsail for just **$5/month**.

**Perfect for:** 2-10 engineers, internal testing, MVP development

---

## 🚀 Quick Deploy (15 Minutes)

### Step 1: Create Lightsail Instance

**Via AWS Console:**
1. Go to https://lightsail.aws.amazon.com/
2. Click **"Create instance"**
3. Select:
   - Platform: **Linux/Unix**
   - Blueprint: **OS Only** → **Ubuntu 22.04 LTS**
   - Plan: **$5/month** (1 GB RAM, 1 vCPU, 40 GB SSD)
4. Name: `dinebuddy`
5. Click **"Create instance"**
6. Wait ~2 minutes for it to start

### Step 2: Download SSH Key

1. In Lightsail console, click **Account** → **SSH Keys**
2. Download default key (or create new one)
3. Save as `~/Downloads/LightsailKey.pem`

```bash
chmod 400 ~/Downloads/LightsailKey.pem
```

### Step 3: Get Instance IP

1. Click your `dinebuddy` instance
2. Note the **Public IP** (e.g., 18.206.XXX.XXX)

### Step 4: Open Firewall Port

1. In your instance page, go to **Networking** tab
2. Under **IPv4 Firewall**, click **Add rule**
3. Set:
   - Application: **Custom**
   - Protocol: **TCP**
   - Port: **8000**
4. Click **Create**

### Step 5: SSH and Deploy

```bash
# SSH into your instance
ssh -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_INSTANCE_IP

# Clone your repository
git clone https://github.com/YOUR_USERNAME/DineBuddy.git
cd DineBuddy

# Run automated deployment script
./scripts/deploy_lightsail.sh

# Follow the prompts - it will:
# - Install Docker
# - Create .env file with secure passwords
# - Start all services
# - Run database migrations
# - Test the deployment
```

### Step 6: Test Your Deployment

```bash
# From your local machine:
curl http://YOUR_INSTANCE_IP:8000/api/v1/health

# Open in browser:
open http://YOUR_INSTANCE_IP:8000/api/v1/docs
```

**Done!** Your API is live. 🎉

---

## 📝 Manual Deployment (Alternative)

If you prefer to deploy manually instead of using the script:

### Install Docker

```bash
# SSH into instance first
ssh -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_INSTANCE_IP

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt update
sudo apt install docker-compose -y

# Log out and back in for group changes
exit
ssh -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_INSTANCE_IP
```

### Clone and Configure

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/DineBuddy.git
cd DineBuddy

# Create .env file
cp backend/.env.example backend/.env

# Generate secure passwords
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(16))"

# Edit .env with these values
nano backend/.env
```

### Deploy

```bash
# Start services
docker-compose up -d

# Wait 30 seconds for database to initialize
sleep 30

# Run migrations
docker-compose exec backend alembic upgrade head

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## 🔄 Updating Your Application

When you push new code:

```bash
# SSH into instance
ssh -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_INSTANCE_IP
cd DineBuddy

# Pull latest changes
git pull

# Restart with new code
docker-compose down
docker-compose up -d --build

# Run any new migrations
docker-compose exec backend alembic upgrade head

# Check logs
docker-compose logs -f backend
```

---

## 💾 Database Backups

### Manual Backup

```bash
# Create backup
docker-compose exec db pg_dump -U postgres dinebuddy | gzip > ~/backups/db_$(date +%Y%m%d).sql.gz

# Download to your local machine
scp -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_IP:~/backups/db_*.sql.gz ./
```

### Automated Daily Backups

```bash
# Create backup directory
mkdir -p ~/backups

# Create backup script
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
cd ~/DineBuddy
docker-compose exec -T db pg_dump -U postgres dinebuddy | gzip > ~/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz
find ~/backups -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x ~/backup-db.sh

# Schedule daily at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/ubuntu/backup-db.sh
```

### Restore from Backup

```bash
# Stop backend temporarily
docker-compose stop backend

# Restore database
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U postgres -d dinebuddy

# Start backend
docker-compose start backend
```

---

## 📊 Monitoring

### Check Resource Usage

```bash
# Memory and CPU
docker stats

# Disk space
df -h

# Application logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f db
```

### View Application Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 backend

# Search logs
docker-compose logs backend | grep ERROR
```

---

## 🔧 Common Tasks

### Restart Services

```bash
cd ~/DineBuddy
docker-compose restart
```

### View Database

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U postgres -d dinebuddy

# Useful commands:
\dt              # List tables
\d+ restaurants  # Describe table
SELECT * FROM restaurants LIMIT 10;
\q               # Quit
```

### Run Migrations

```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1
```

### Clean Restart

```bash
# Stop and remove containers (keeps database data)
docker-compose down
docker-compose up -d

# Nuclear option (deletes database!)
docker-compose down -v
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check logs
docker-compose logs

# Restart Docker
sudo systemctl restart docker
```

### Out of disk space

```bash
# Clean Docker
docker system prune -a --volumes

# Check disk usage
df -h
du -sh /var/lib/docker/*
```

### Out of memory

```bash
# Check memory
free -h

# Add 2GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Can't connect to API

```bash
# Check if port 8000 is open in Lightsail firewall
# Check if service is running
docker-compose ps

# Check if listening on correct port
docker-compose exec backend curl localhost:8000/api/v1/health
```

### Database connection issues

```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

---

## 🔒 Security Improvements

### Basic Security Setup

```bash
# Enable firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 8000/tcp
sudo ufw enable

# Disable password authentication
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Enable automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Change Default Passwords

```bash
# Generate new passwords
python3 -c "import secrets; print('DB_PASS:', secrets.token_urlsafe(16))"
python3 -c "import secrets; print('SECRET_KEY:', secrets.token_urlsafe(32))"

# Update backend/.env
nano backend/.env

# Restart services
docker-compose down
docker-compose up -d
```

---

## 💰 Cost Breakdown

### What's Included in $5/month

```
Compute:
- 1 vCPU
- 1 GB RAM
- 40 GB SSD storage

Network:
- 2 TB data transfer/month
- 1 static IP (included)

Services (Docker):
- PostgreSQL database (free)
- FastAPI backend (free)

Total: $5/month = $60/year
```

### Usage Limits

- **Suitable for:** 2-10 users, internal testing, MVP
- **API Requests:** ~10,000-50,000/day
- **Database Size:** Up to ~20GB
- **Traffic:** 2TB/month (plenty)

---

## 📈 When to Upgrade

Upgrade when you need:
- 💰 **More resources:** Lightsail $10/month (2GB RAM)
- 🚀 **Auto-scaling:** ECS Fargate (~$70/month)
- 💾 **Managed database:** RDS (~$15/month extra)
- 🌐 **Load balancing:** Application Load Balancer (~$25/month)
- 🔒 **High availability:** Multi-AZ setup (~$150/month)

**For now:** Stick with $5/month Lightsail! ✨

---

## ✅ What You Get

✅ **PostgreSQL database** - Full features, Alembic migrations  
✅ **FastAPI backend** - Auto-scaling within your instance  
✅ **Static IP** - Stable endpoint for testing  
✅ **Predictable cost** - Flat $5/month  
✅ **Easy management** - Docker Compose  
✅ **Quick deployment** - 15 minutes total  

---

## 📚 Additional Resources

- **Lightsail Console:** https://lightsail.aws.amazon.com/
- **Lightsail Pricing:** https://aws.amazon.com/lightsail/pricing/
- **Lightsail Docs:** https://lightsail.aws.amazon.com/ls/docs/
- **Docker Docs:** https://docs.docker.com/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

**You're all set! Focus on building features, not managing infrastructure.** 🚀
