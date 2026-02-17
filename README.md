# Калькулятор себестоимости

Веб-приложение с 3-мя калькуляторами себестоимости поставки для внутренней команды.

## Стек технологий

- **Frontend**: Next.js (React), TypeScript, MUI, react-hook-form, Zod
- **Backend**: FastAPI, Python 3.11+, Pydantic
- **Хранение данных**: Google Sheets (справочники), Redis (кэш)
- **Оркестрация**: Docker Compose

## Запуск проекта

### Предварительные требования

1. Docker и Docker Compose
2. Google Sheet ID и credentials.json для доступа к Google Sheets API

### Установка

1. Создайте файл `.env` в корне проекта:
   ```
   GOOGLE_SHEET_ID=your_sheet_id
   ```

2. Разместите `credentials.json` в папке `apps/api/` (Service Account Google Sheets)

3. Запустите контейнеры:
   ```bash
   docker-compose up --build
   ```

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
