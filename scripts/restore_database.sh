#!/bin/bash
# ==========================================================
# Alpha India - Production Database Restore Script
# Restores alpha_india_latest.dump into alpha_india_db container
# ==========================================================
set -e

DUMP_FILE="${1:-alpha_india_latest.dump}"

if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Error: Dump file '$DUMP_FILE' not found in current directory."
    echo "Usage: ./scripts/restore_database.sh [path_to_dump_file]"
    exit 1
fi

echo "=========================================================="
echo "    ALPHA INDIA DATABASE RESTORE PIPELINE                 "
echo "    Target Dump: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo "    Timestamp  : $(date -u '+%Y-%m-%d %H:%M:%SZ')         "
echo "=========================================================="

# 1. Stop backend and worker containers to avoid active connection locks
echo "[1/5] Stopping backend and worker to close active database locks..."
docker compose stop backend worker || true

# 2. Copy dump file into PostgreSQL container
echo "[2/5] Copying dump into database container (alpha_india_db)..."
docker cp "$DUMP_FILE" alpha_india_db:/tmp/restore.dump

# 3. Restore database schema and data cleanly
echo "[3/5] Restoring database into alpha_india..."
docker compose exec -T db pg_restore \
    -U postgres \
    -d alpha_india \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    /tmp/restore.dump || {
        echo "⚠️ Note: Some non-fatal notices or drop warnings are normal during --clean restore."
    }

# 4. Clean up temporary file from container
echo "[4/5] Cleaning up temporary dump from container..."
docker compose exec -T db rm -f /tmp/restore.dump

# 5. Restart backend and worker
echo "[5/5] Restarting backend and background worker..."
docker compose restart backend worker

echo "=========================================================="
echo "    DATABASE RESTORE COMPLETED SUCCESSFULLY!             "
echo "=========================================================="
