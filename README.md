# Калькулятор себестоимости

Веб-приложение с 3-мя калькуляторами себестоимости поставки для внутренней команды.

## Стек технологий

- **Frontend**: Next.js (React), TypeScript, MUI, react-hook-form, Zod
- **Backend**: FastAPI, Python 3.11+, Pydantic
- **Хранение данных**: Local JSON / Google Sheets (справочники), Redis (кэш)
- **Оркестрация**: Docker Compose

## Запуск проекта

### Предварительные требования

1. Docker и Docker Compose
2. Для режима `sheets` нужен Google Sheet ID и credentials.json

### Установка

1. Создайте файл `.env` в корне проекта:
   ```
   REFERENCE_DATA_SOURCE=sheets
   LOCAL_DATA_PATH=/app/data/reference_data.local.json
   GOOGLE_SHEET_ID=your_sheet_id
   ```

2. Если используете `REFERENCE_DATA_SOURCE=sheets` или `auto`, разместите `credentials.json` в папке `apps/api/` (Service Account Google Sheets)

3. Запустите контейнеры в production-режиме:
   ```bash
   docker-compose up --build
   ```

   Для размещения фронтенда в подпути (например, `https://polygonplast.ru/calculator`) задайте переменные окружения перед запуском:
   ```bash
   export NEXT_PUBLIC_BASE_PATH=/calculator
   export NEXT_PUBLIC_API_URL=/calculator/api
   docker compose up -d --build
   ```

4. Для локальной разработки с hot-reload используйте отдельный compose-файл:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

### Режимы источника данных

- `local` - только локальный файл `apps/api/data/reference_data.local.json`
- `sheets` - только Google Sheets
- `auto` - сначала Google Sheets, при ошибке fallback на локальный JSON

### Доступ к сервисам

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation (Swagger): http://localhost:8000/docs
- Redis: localhost:6379

## Структура проекта

```
/
├── apps/
│   ├── web/              # Next.js фронтенд
│   └── api/              # FastAPI бэкенд
├── docker-compose.yml
└── README.md
```

## Production vs Development

- `docker-compose.yml` - production режим (без Next.js HMR и без `uvicorn --reload`)
- `docker-compose.dev.yml` - development режим (с HMR/auto-reload)

## Разработка

### Frontend
```bash
cd apps/web
npm install
npm run dev
```

### Backend
```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload
```
