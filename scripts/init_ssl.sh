#!/bin/bash
# ==========================================================
# Alpha India - Let's Encrypt SSL Bootstrap Script
# Obtains genuine SSL certificates for ipodesk.shop and subdomains
# ==========================================================

set -e

DOMAINS=("ipodesk.shop" "www.ipodesk.shop" "api.ipodesk.shop")
RSA_KEY_SIZE=4096
DATA_PATH="./certbot_data"
EMAIL="admin@ipodesk.shop"
STAGING=0 # Set to 1 if you are testing to avoid rate limits

# Read from .env if present
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    if [ ! -z "$CERTBOT_EMAIL" ]; then
        EMAIL="$CERTBOT_EMAIL"
    fi
fi

echo "==> Preparing Let's Encrypt SSL certificates for: ${DOMAINS[*]}"

# 1. Create dummy certificate if no certificate exists yet
CERT_PATH="/etc/letsencrypt/live/ipodesk.shop"
echo "==> Checking if dummy certificates are required for initial Nginx boot..."

docker compose run --rm --entrypoint "\
  sh -c '\
    mkdir -p $CERT_PATH && \
    if [ ! -f $CERT_PATH/fullchain.pem ]; then \
      echo \"Generating temporary self-signed certificate...\" && \
      openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout $CERT_PATH/privkey.pem \
        -out $CERT_PATH/fullchain.pem \
        -subj \"/CN=localhost\"; \
    fi'" certbot

# 2. Start Nginx
echo "==> Starting Nginx container..."
docker compose up --force-recreate -d nginx

# 3. Wait for Nginx to boot
sleep 5

# 4. Request Genuine Let's Encrypt Certificate
echo "==> Requesting Let's Encrypt SSL certificate..."
DOMAIN_ARGS=""
for DOMAIN in "${DOMAINS[@]}"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $DOMAIN"
done

STAGING_ARG=""
if [ $STAGING -ne 0 ]; then
    STAGING_ARG="--staging"
fi

EMAIL_ARG="--register-unsafely-without-email"
if [ ! -z "$EMAIL" ]; then
    EMAIL_ARG="--email $EMAIL"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $EMAIL_ARG \
    $DOMAIN_ARGS \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal" certbot

# 5. Reload Nginx with genuine certificates
echo "==> Reloading Nginx with verified certificates..."
docker compose exec nginx nginx -s reload

echo "=========================================================="
echo "SSL SETUP COMPLETED SUCCESSFULLY FOR ${DOMAINS[*]}"
echo "Your platform is live with HTTPS at https://ipodesk.shop"
echo "=========================================================="
