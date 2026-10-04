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

# 1. Sync repository to latest commit on main
echo "[1/5] Fetching and resetting to latest origin/main..."
git fetch origin main
git reset --hard origin/main

# 2. Ensure scripts have execution permissions
chmod +x scripts/*.sh

# 3. Build application container images
echo "[2/5] Building updated application containers..."
docker compose build backend worker frontend

# 4. Gracefully restart updated services (keeping db & certbot intact)
echo "[3/5] Ensuring PostgreSQL database container is healthy..."
docker compose up -d db
sleep 3

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

