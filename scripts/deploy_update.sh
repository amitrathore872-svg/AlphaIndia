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
echo "[3/5] Restarting updated containers..."
docker compose up -d --remove-orphans backend worker frontend nginx

# 5. Ensure database schema integrity
echo "[4/5] Verifying database schema..."
docker compose exec -T backend python -c "
from app.db.database import Base, engine
Base.metadata.create_all(bind=engine)
print('Database tables verified.')
" || true

# 6. Prune untagged/dangling images to conserve EC2 disk space
echo "[5/5] Pruning dangling Docker images..."
docker image prune -f

echo "=========================================================="
echo "         DEPLOYMENT TO EC2 COMPLETED SUCCESSFULLY!        "
echo "=========================================================="
docker compose ps
