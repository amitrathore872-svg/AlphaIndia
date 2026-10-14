#!/bin/bash
# ==========================================================
# Alpha India - Production Continuous Deployment Script
# ==========================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=========================================================="
echo "    ALPHA INDIA CONTINUOUS DEPLOYMENT PIPELINE            "
echo "    Timestamp: $(date -u '+%Y-%m-%d %H:%M:%SZ')           "
echo "    Directory: $PROJECT_DIR                               "
echo "=========================================================="

# 0. Emergency & Proactive Disk Space Reclamation (Crucial for EC2 EBS volumes)
echo "[0/5] Checking and reclaiming disk space on root volume..."
echo "--- Initial Disk Status ---"
df -h /

# Prune unused build cache and untagged images before doing any builds or fetches
echo "Pruning Docker build cache and dangling containers/images..."
docker builder prune -a -f 2>/dev/null || true
docker image prune -a -f 2>/dev/null || true
docker system prune -a -f --volumes=false 2>/dev/null || true

# Truncate oversized container logs (>5MB)
sudo find /var/lib/docker/containers/ -name "*-json.log" -size +5M -exec truncate -s 1M {} + 2>/dev/null || true

# Clean system journal logs, package manager cache, and tmp files
sudo journalctl --vacuum-time=1d 2>/dev/null || sudo journalctl --vacuum-size=10M 2>/dev/null || true
sudo apt-get clean 2>/dev/null || sudo yum clean all 2>/dev/null || true
sudo rm -rf /var/cache/apt/archives/* /tmp/* /var/tmp/* /var/log/*.gz /var/log/*.[0-9] 2>/dev/null || true

# Purge any host node_modules or .next caches that may have been created outside Docker
rm -rf "$PROJECT_DIR/frontend/node_modules" "$PROJECT_DIR/frontend/.next" 2>/dev/null || true

# Auto-grow filesystem in case EBS volume was resized on AWS
sudo growpart /dev/nvme0n1 1 2>/dev/null || sudo growpart /dev/xvda 1 2>/dev/null || true
sudo resize2fs /dev/nvme0n1p1 2>/dev/null || sudo resize2fs /dev/xvda1 2>/dev/null || sudo xfs_growfs / 2>/dev/null || true

echo "--- Disk Status After Cleanup ---"
df -h /

# 1. Sync repository to latest commit on main
echo "[1/5] Fetching and resetting to latest origin/main..."
git fetch origin main
git reset --hard origin/main

# 2. Ensure scripts have execution permissions
chmod +x scripts/*.sh

# Enable Docker BuildKit for parallel optimization and layer caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 3. Free physical RAM on the 2GB t3.small EC2 server before starting builds
# Pausing background worker and previous frontend frees ~800MB+ RAM so Next.js builds in physical RAM instead of thrashing swap
echo "Temporarily pausing worker and frontend containers to maximize build RAM..."
docker compose stop worker frontend || true
sync
sudo sysctl -w vm.drop_caches=3 2>/dev/null || true

# 4. Build application container images sequentially to prevent peak disk exhaustion
echo "[2/5] Building backend container image..."
docker compose build backend

echo "Reclaiming build cache before building frontend..."
docker builder prune -f 2>/dev/null || true

echo "Building frontend container image..."
docker compose build frontend

echo "Reclaiming intermediate build cache..."
docker builder prune -a -f 2>/dev/null || true

# 5. Gracefully restart updated services (keeping db & certbot intact)
echo "[3/5] Ensuring PostgreSQL database container is healthy..."
docker compose up -d db
sleep 2

echo "Restarting updated containers with force recreate..."
docker compose up -d --force-recreate --remove-orphans db backend worker frontend nginx

echo "Waiting 8s for backend container startup..."
sleep 8
echo "--- Container Status ---"
docker compose ps
echo "--- Backend Startup Logs ---"
docker compose logs --tail=50 backend
echo "--- Database Status ---"
docker compose logs --tail=20 db

# 5. Ensure database schema integrity, normalize status, and verify master company list & mutual fund seeds
echo "[4/5] Verifying database schema, normalization, master companies, and mutual fund intelligence..."
docker compose exec -T backend python -m scripts.ensure_production_seed || {
    echo "WARNING: Backend database verification failed. Outputting full backend logs:"
    docker compose logs --tail=100 backend
}

# 6. Reload Nginx to ensure new reverse-proxy routes (/api/, /health) take effect
echo "Testing and restarting Nginx reverse proxy..."
docker compose exec -T nginx nginx -t || true
docker compose restart nginx

# 7. Prune untagged/dangling images to conserve EC2 disk space
echo "[5/5] Pruning dangling Docker images..."
docker image prune -f

echo "=========================================================="
echo "         DEPLOYMENT TO EC2 COMPLETED SUCCESSFULLY!        "
echo "=========================================================="
docker compose ps
echo ""
echo "--- Backend Container Logs (Last 50 Lines) ---"
docker compose logs --tail=50 backend

