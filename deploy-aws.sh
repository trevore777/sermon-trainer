#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/apps/sermon-trainer
DOMAIN=sermon-trainer.eduappsplus.com.au

cd "$APP_DIR"
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs
pm2 save

sudo cp nginx-sermon-trainer.conf /etc/nginx/sites-available/sermon-trainer
sudo ln -sfn /etc/nginx/sites-available/sermon-trainer /etc/nginx/sites-enabled/sermon-trainer
sudo nginx -t
sudo systemctl reload nginx

echo "App deployed on port 3106."
echo "Next, if DNS points to this Lightsail server, run:"
echo "sudo certbot --nginx -d $DOMAIN"
echo "Health check: curl -s http://127.0.0.1:3106/health"
