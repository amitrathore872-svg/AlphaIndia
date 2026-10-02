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

# 5. Ensure database schema integrity, normalize status, and verify master company list
echo "[4/5] Verifying database schema, normalization, and master company list..."
docker compose exec -T backend python -c "
from app.db.database import Base, engine, SessionLocal
import app.models
from sqlalchemy import text
Base.metadata.create_all(bind=engine)

try:
    with engine.connect() as conn:
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS velocity_market_regime (
                id SERIAL PRIMARY KEY,
                calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                market_score FLOAT NOT NULL DEFAULT 50.0,
                market_bias VARCHAR(50) NOT NULL,
                risk_level VARCHAR(30) NOT NULL DEFAULT 'MODERATE',
                position_size_multiplier FLOAT NOT NULL DEFAULT 1.0,
                nifty_price FLOAT,
                nifty_change_pct FLOAT,
                banknifty_price FLOAT,
                banknifty_change_pct FLOAT,
                vix_value FLOAT,
                vix_change_pct FLOAT,
                advance_decline_ratio FLOAT,
                sector_breadth_pct FLOAT,
                gift_nifty FLOAT,
                dollar_index FLOAT,
                us_10y_yield FLOAT,
                brent_crude FLOAT,
                component_scores JSON,
                weights_used JSON,
                summary_verdict TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS nifty_price FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS nifty_change_pct FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS banknifty_price FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS banknifty_change_pct FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS vix_value FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS vix_change_pct FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS advance_decline_ratio FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS sector_breadth_pct FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS gift_nifty FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS dollar_index FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS us_10y_yield FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS brent_crude FLOAT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS component_scores JSON;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS weights_used JSON;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS summary_verdict TEXT;
            ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        '''))
        conn.commit()
    print('Database tables and velocity schema verified.')
except Exception as e:
    print(f'Schema verification notice: {e}')
"

# Run database optimization (normalizes 'ACTIVE' -> 'Active', deduplicates indexes)
try:
    from scripts.optimize_production_database import optimize_database
    optimize_database()
except Exception as e:
    print(f'Optimization note: {e}')

db = SessionLocal()
try:
    active_count = db.query(Company).filter(Company.listing_status == 'Active').count()
    print(f'Active companies in database: {active_count}')
    if active_count < 100:
        print('Seeding full NSE company master list (2,100+ equities)...')
        from scripts.import_nse_companies import import_nse_companies
        import_nse_companies()
        refreshed = db.query(Company).filter(Company.listing_status == 'Active').count()
        print(f'Seeding completed. Total active companies: {refreshed}')
finally:
    db.close()
" || {
    echo "WARNING: Backend container check failed. Outputting full backend logs:"
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

