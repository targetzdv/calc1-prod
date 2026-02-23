# Server Runbook: polygonplast.ru/calculator

## 1) Clone and open project

```bash
sudo mkdir -p /opt/calc1-prod
sudo chown -R $USER:$USER /opt/calc1-prod
git clone https://github.com/targetzdv/calc1-prod.git /opt/calc1-prod
cd /opt/calc1-prod
```

If repo already exists:

```bash
cd /opt/calc1-prod
git pull origin main
```

## 2) Prepare environment

```bash
cp deploy/env/.env.prod.example .env
```

Set at least these values in `.env`:

- `GOOGLE_SHEET_ID=...`
- `GOOGLE_CREDENTIALS_FILE=/opt/calc1-prod/secrets/credentials.json`
- `NEXT_PUBLIC_BASE_PATH=/calculator`
- `NEXT_PUBLIC_API_URL=/calculator/api`
- `WEB_BIND_HOST=127.0.0.1`
- `API_BIND_HOST=127.0.0.1`
- `REDIS_BIND_HOST=127.0.0.1`

## 3) Place Google credentials

```bash
mkdir -p /opt/calc1-prod/secrets
# copy credentials.json to /opt/calc1-prod/secrets/credentials.json
chmod 600 /opt/calc1-prod/secrets/credentials.json
```

## 4) Start/update app

```bash
./scripts/deploy-prod.sh
```

## 5) Nginx config for /calculator

In your `server {}` block for `polygonplast.ru`, include the locations from:

- `deploy/nginx/polygonplast.ru.calculator.conf`

Then validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Smoke checks

```bash
curl -I https://polygonplast.ru/calculator/
curl -I https://polygonplast.ru/calculator/api/health
```

## 7) Rollback (quick)

```bash
cd /opt/calc1-prod
git log --oneline -n 5
# choose previous stable commit, example: 36781e9
git checkout 36781e9
./scripts/deploy-prod.sh
```

After rollback verification, you can pin a rollback branch/tag.
