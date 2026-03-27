# Server Runbook: calculator.polygonplast.ru

## Current production shape

- Public URL: `https://calculator.polygonplast.ru/`
- API URL: `https://calculator.polygonplast.ru/api/...`
- Server path: `/opt/calc1-prod`
- Main host: `root@91.222.238.79`
- Current prod works as a subdomain root deployment, not as `/calculator` under `polygonplast.ru`

## 1) Server prerequisites

The server is small (`~2 GB RAM`), so swap is required for safe Next.js production builds.

```bash
ssh root@91.222.238.79
```

### Ensure swap exists

```bash
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

free -h
swapon --show
```

## 2) Production environment

Current prod values in `/opt/calc1-prod/.env` should stay in the subdomain mode:

```bash
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_API_URL=/api
WEB_BIND_HOST=127.0.0.1
API_BIND_HOST=127.0.0.1
REDIS_BIND_HOST=127.0.0.1
REFERENCE_DATA_SOURCE=sheets
GOOGLE_SHEET_ID=...
GOOGLE_CREDENTIALS_FILE=/opt/calc1-prod/secrets/credentials.json
API_PROXY_TARGET=http://api:8000
```

Google credentials must exist at:

```bash
ls -l /opt/calc1-prod/secrets/credentials.json
```

## 3) Sync code to server

At the moment, the authoritative prod copy lives in `/opt/calc1-prod` and is updated by file sync.

From your local machine:

```bash
rsync -azh --delete \
  --exclude='.DS_Store' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='credentials.json' \
  -e 'ssh -i ~/.codex-ssh/deploy_ed25519' \
  ./apps/ root@91.222.238.79:/opt/calc1-prod/apps/
```

Important:
- Until prod-specific web build settings are merged back into the repo, do not blindly overwrite server-specific deployment files without checking them first.
- In particular, verify `/opt/calc1-prod/apps/web/Dockerfile` and `/opt/calc1-prod/apps/web/next.config.ts` before deploy if the frontend build pipeline changed.

## 4) Create rollback image tags before rebuild

```bash
cd /opt/calc1-prod
ts=$(date +%Y%m%d-%H%M%S)
docker image tag calc1-prod-web calc1-prod-web:backup-$ts
docker image tag calc1-prod-api calc1-prod-api:backup-$ts
echo "$ts"
```

## 5) Safe deploy flow

Build first, switch later. This keeps the current site alive during image build.

```bash
cd /opt/calc1-prod

docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml build api web
docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d api web
docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
```

If only backend changed:

```bash
cd /opt/calc1-prod

docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml build api
docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d api
docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml ps api
```

## 6) Smoke checks

```bash
curl https://calculator.polygonplast.ru/api/health
curl https://calculator.polygonplast.ru/api/data/calculator2-config
curl -X POST https://calculator.polygonplast.ru/api/calculate/calc-2 \
  -H 'Content-Type: application/json' \
  -d '{"purchase_price_cny_per_kg":33,"weight_kg":100,"exchange_rate_cny_to_rub_adjusted":14.55}'
curl -I https://calculator.polygonplast.ru/
```

Expected for the sample `Calculator 2` request:

- `total_cost_rub = 141013.94`
- `cost_per_kg_rub = 1410.14`
- constants should include:
  - `intl_delivery_usd_per_kg = 3.5`
  - `usd_to_cny_rate = 7.2`
  - `supplier_vat_divisor = 1.05`
  - `rate_markup_percent = 5.0`

## 7) Rollback

If the new release behaves badly and you know the backup tag timestamp:

```bash
cd /opt/calc1-prod

docker image tag calc1-prod-web:backup-YYYYMMDD-HHMMSS calc1-prod-web
docker image tag calc1-prod-api:backup-YYYYMMDD-HHMMSS calc1-prod-api
docker compose --env-file .env -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --no-build
```

Then re-run the smoke checks above.

## 8) Calculator 2 note about Google Sheets

Current production Google Sheet `calculator2_parameters` contains incorrect values in several rows, for example:

- `intl_delivery_usd_per_kg = 46 145,00`
- `usd_to_cny_rate = 46 060,00`
- `supplier_vat_divisor = 46 143,00`

Those are not valid business constants for `Calculator 2`.

Production code now protects against this by falling back to local sane defaults for out-of-range constants while still using the official CBR rate for `CNY/RUB`.

What this means in practice:

- If the app works, nothing urgent must be done right now.
- Later it is worth cleaning the sheet so these rows contain the intended values:
  - `3.50`
  - `7.20`
  - `1.05`
- Even after cleaning the sheet, keeping the fallback guard is useful as a safety net.
