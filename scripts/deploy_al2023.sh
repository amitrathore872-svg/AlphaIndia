#!/bin/bash
# ==========================================================
# Alpha India - Production Deployment Script
# Target: AWS EC2 (Amazon Linux 2023 / t3.small)
# ==========================================================

set -e

echo "=========================================================="
echo "    ALPHA INDIA AWS EC2 (AL2023) DEPLOYMENT PIPELINE      "
echo "=========================================================="

# 1. Check or Setup 4GB Swap Space (CRITICAL for t3.small 2GB RAM)
echo "[1/6] Checking system swap memory configuration..."
SWAP_EXISTS=$(swapon --show | wc -l)
if [ "$SWAP_EXISTS" -le 1 ]; then
    echo "Creating 4GB swap file to prevent OOM errors on t3.small during Next.js build..."
    sudo dd if=/dev/zero of=/swapfile bs=128M count=32 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
    fi
    echo "Swap enabled successfully: 4GB virtual headroom created."
else
    echo "Swap space already active."
fi

# 2. Install Docker and Docker Compose on Amazon Linux 2023
echo "[2/6] Verifying Docker and system dependencies..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker engine via dnf..."
    sudo dnf update -y
    sudo dnf install -y docker git
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
fi

# Install Docker Compose CLI Plugin if missing
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose v2 plugin..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o $DOCKER_CONFIG/cli-plugins/docker-compose
    chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
    sudo ln -sf $DOCKER_CONFIG/cli-plugins/docker-compose /usr/local/bin/docker-compose || true

    echo "Installing Docker Buildx plugin..."
    curl -SL "https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64" -o $DOCKER_CONFIG/cli-plugins/docker-buildx
    chmod +x $DOCKER_CONFIG/cli-plugins/docker-buildx
fi

echo "Docker Version: $(docker --version)"
echo "Docker Compose Version: $(docker compose version)"

# 3. Environment Configuration
echo "[3/6] Checking environment configuration (.env)..."
if [ ! -f .env ]; then
    echo "No .env found. Creating .env from .env.production.example..."
    cp .env.production.example .env
    
    # Auto-generate a secure 64-char SECRET_KEY
    RANDOM_SECRET=$(openssl rand -hex 32)
    sed -i "s/e83a4f6d90bc128f4a7c5b6e2d1a3f5c7b9e0a2d4f6a8c1e3b5d7f9a1c3e5b7d/$RANDOM_SECRET/g" .env
    
    # Generate random Postgres password
    RAND_PG_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    sed -i "s/GenerateStrongPassword2026!/$RAND_PG_PASS/g" .env
    
    echo "==> Generated new random SECRET_KEY and POSTGRES_PASSWORD in .env"
fi

# 4. Build Containers
echo "[4/6] Building production Docker images..."
docker compose build

# 5. Start Services
echo "[5/6] Starting containerized microservices..."
docker compose up -d

# 6. Database Health & Data Initialization
echo "[6/6] Verifying database connectivity and initial master tables..."
sleep 10

echo "Checking if NSE company universe needs bootstrapping..."
docker compose exec backend python -c "
from app.db.database import SessionLocal
from app.models.company import Company
db = SessionLocal()
count = db.query(Company).count()
db.close()
print(f'Current equities in database: {count}')
if count == 0:
    print('Empty database detected. Running import_nse_companies...')
    import subprocess
    subprocess.run(['python', '-m', 'scripts.import_nse_companies'])
" || true

echo "=========================================================="
echo "         ALPHA INDIA DEPLOYED SUCCESSFULLY!               "
echo "=========================================================="
echo "Container Status:"
docker compose ps
echo ""
echo "Next Step (SSL Setup):"
echo "Once your DNS records for ipodesk.shop and api.ipodesk.shop point to this EC2 IP,"
echo "run the SSL bootstrap script:"
echo "  chmod +x scripts/init_ssl.sh"
echo "  ./scripts/init_ssl.sh"
echo "=========================================================="
