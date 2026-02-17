# Memory Bank - Calculator Project

## Project Info

**Название проекта:** Калькулятор себестоимости поставки
**Текущий статус:** Этап 7 завершён - Calculator1 полностью функционален

---

## Цель продукта

Веб-приложение с 3-мя калькуляторами себестоимости поставки для внутренней команды логистической компании.

**Целевой пользователь:** Внутренняя команда (менеджеры по закупкам, логисты)

**Ожидаемый результат:**
- Три калькулятора с разными логиками расчёта
- Удобный UI с формой ввода и блоком результата
- Кнопка копирования результата в буфер обмена
- Справочные данные загружаются из Google Sheets

---

## Стек технологий

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI Library:** MUI v7.3.8 (Material UI)
- **Forms:** react-hook-form + Zod validation
- **API Client:** fetch / axios

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Validation:** Pydantic
- **Data Source:** Google Sheets API
- **Cache:** Redis

### Infrastructure
- **Orchestration:** Docker Compose
- **Services:** web (3000), api (8000), redis (6379)

---

## Структура проекта

```
/
├── apps/
│   ├── web/              # Next.js фронтенд
│   │   ├── app/
│   │   │   ├── layout.tsx           # ✅ Layout с ThemeRegistry
│   │   │   └── page.tsx            # ✅ Главная страница (Calculator)
│   │   ├── components/
│   │   │   ├── Calculator.tsx       # ✅ Основной компонент с вкладками
│   │   │   ├── CalculatorTabs.tsx    # ✅ Компонент вкладок (MUI Tabs)
│   │   │   ├── ResultBlock.tsx      # ✅ Блок результата
│   │   │   ├── FormInputs.tsx       # ✅ Форма с react-hook-form + Zod
│   │   │   └── ThemeRegistry.tsx    # ✅ Client-обёртка для MUI Theme
│   │   └── lib/
│   │       ├── constants.ts          # ✅ Константы из Excel
│   │       └── api.ts               # ⏳ Создать на Этапе 7
│   └── api/              # FastAPI бэкенд
│       ├── main.py                      # ✅ FastAPI с POST /calculate
│       ├── models/
│       │   ├── CalculatorRequest.py      # ✅ Модель запроса
│       │   └── CalculatorResponse.py   # ✅ Модель ответа
│       ├── calculators/                 # ✅ Модули расчётов (заглушки)
│       │   ├── __init__.py
│       │   ├── calculator1.py
│       │   ├── calculator2.py
│       │   └── calculator3.py
│       └── repositories/
│           └── sheets_repo.py         # ✅ Google Sheets + кэш (Этап 5)
├── docker-compose.yml
├── .gitignore
├── .env                    # ✅ Создан с GOOGLE_SHEET_ID
├── .env.example
└── README.md
```

---

## Текущий прогресс

### Этап 1: ✅ Завершён
- [x] Создана структура папок и файлов
- [x] Настроен Docker Compose (web, api, redis)
- [x] Инициализирован Next.js проект с TypeScript
- [x] Установлены зависимости (MUI, react-hook-form, Zod)
- [x] Инициализирован FastAPI проект
- [x] Созданы Dockerfile для обоих сервисов

### Этап 2: ✅ Завершён (Backend - Базовая структура API)
- [x] Создана Pydantic модель `CalculatorRequest`
- [x] Создана Pydantic модель `CalculatorResponse`
- [x] Создан POST `/calculate` endpoint с валидацией
- [x] Созданы заглушки калькуляторов
- [x] Custom validation error handler

### Этап 3: ✅ Завершён (Frontend - Базовый UI с вкладками)
- [x] Обновлён layout.tsx: metadata "Калькулятор себестоимости", ThemeRegistry
- [x] Создан ThemeRegistry.tsx - client-компонент для MUI ThemeProvider
- [x] Создан CalculatorTabs.tsx - MUI Tabs для переключения (1, 2, 3)
- [x] Создан ResultBlock.tsx - блок результата с placeholder
- [x] Создан Calculator.tsx - основной компонент с двумя блоками
- [x] Адаптивный лейаут: Desktop - 2 колонки, Mobile - 1 колонка
- [x] Акцентный цвет #3B82F6 настроен

### Этап 4: ✅ Завершён (Frontend - Форма ввода)
- [x] Создан `lib/constants.ts` с данными из Excel:
  - MATERIALS - 11 материалов
  - CONTAINER_SIZES - 3 размера
  - CITY_PORT_MAP - маппинг город→порт (19 городов)
  - PORTS - 2 порта (Новороссийск, Владивосток)
  - RAILWAY_STATIONS - ЖД станции по портам
  - ALL_RAILWAY_STATIONS - все станции в одном списке
- [x] Создан `components/FormInputs.tsx`:
  - react-hook-form для управления состоянием
  - Zod validation схема для всех полей
  - MUI TextField для quantity и price_per_kg
  - MUI Select для material, port_from, city_to, railway_station, container_size
  - Error helper text для ошибок валидации
- [x] Интеграция формы в Calculator.tsx
- [x] Заглушка для отправки формы (console.log + setTimeout)
- [x] Loading state на кнопке "Рассчитать"

**Критерии готовности:**
- ✅ Все поля формы отображаются корректно
- ✅ Валидация работает (пустые поля → ошибка)
- ✅ Кнопка "Рассчитать" видна и кликабельна

### Этап 5: ✅ Завершён (Backend - Интеграция с Google Sheets)
- [x] Создан `repositories/sheets_repo.py` для работы с Google Sheets API
- [x] Настроен Google Sheets API через service account (credentials.json)
- [x] Реализован кэш через Redis (TTL 1 час)
- [x] Созданы API эндпоинты для всех справочников
- [x] Корректный парсинг чисел (запятые, пробелы) и процентов (6,50% → 0.065)
- [x] Реализована инвалидация кэша

**API эндпоинты для справочных данных:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/data/materials` | Список материалов |
| GET | `/data/parameters` | Параметры (курсы валют, брокер, НДС) |
| GET | `/data/freight` | Данные по фрахту |
| GET | `/data/customs-fees` | Таможенные сборы по диапазонам |
| GET | `/data/city-port-map` | Маппинг город → порт |
| GET | `/data/car-delivery` | Доставка авто |
| GET | `/data/railway-delivery` | Доставка ЖД от порта |
| GET | `/data/railway-car-delivery` | Доставка ЖД+авто от станции |
| GET | `/data/all` | Все справочные данные |
| POST | `/cache/invalidate` | Очистка кэша |

**Критерии готовности:**
- ✅ API возвращает данные из Google Sheets
- ✅ Кэш работает (повторные запросы → из Redis)
- ✅ Ошибки обрабатываются корректно

### Этап 6: ✅ Завершён (Backend - Реализация бизнес-логики Calculator1)
- [x] Реализована логика маршрутов (определение порта РФ по городу назначения)
- [x] Реализована логика веток:
  - Новороссийск/Санкт-Петербург → автодоставка
  - Владивосток → ЖД (прямая или со станцией)
- [x] Реализованы финансовые расчёты по формулам из formules.md:
  1. Сумма закупки (CNY → RUB)
  2. Фрахт (USD → RUB)
  3. Таможенная стоимость
  4. Пошлина (обычная % от стоимости + особая для PMMA в EUR/кг)
  5. Таможенный сбор по диапазонам
  6. НДС
  7. Брокер
  8. Вывоз/доставка (авто или ЖД)
  9. Банковская комиссия
  10. Полная себестоимость
  11. Себестоимость за 1 кг
- [x] Форматирование чисел с разделителями тысяч
- [x] Обработка 40ftHC как 40 (в Sheets только 20 и 40)
- [x] Обрезка пробелов в названиях материалов
- [x] Особый случай для СПб (город = порт = нет доставки)

**API эндпоинты для справочных данных:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/data/materials` | Список материалов |
| GET | `/data/parameters` | Параметры (курсы валют, брокер, НДС) |
| GET | `/data/freight` | Данные по фрахту |
| GET | `/data/customs-fees` | Таможенные сборы по диапазонам |
| GET | `/data/city-port-map` | Маппинг город → порт |
| GET | `/data/car-delivery` | Доставка авто |
| GET | `/data/railway-delivery` | Доставка ЖД от порта |
| GET | `/data/railway-car-delivery` | Доставка ЖД+авто от станции |
| GET | `/data/all` | Все справочные данные |
| POST | `/cache/invalidate` | Очистка кэша |

**Критерии готовности:**
- ✅ API возвращает данные из Google Sheets
- ✅ Кэш работает (повторные запросы → из Redis)
- ✅ Ошибки обрабатываются корректно

---

### Этап 7: ✅ Завершён (Frontend - Интеграция с API)
- [x] Создан `apps/web/lib/api.ts` с типами и функцией `calculate()`
- [x] Обновлён `Calculator.tsx` для использования реального API
- [x] Добавлена обработка ошибок с Snackbar
- [x] Добавлена кнопка "Сбросить" в `FormInputs.tsx`
- [x] Кнопки "Сбросить" и "Рассчитать" рядом в одной строке

---

## Важные файлы

| Путь | Описание | Статус |
|------|----------|--------|
| `apps/api/calculators/calculator1.py` | Логика Calculator1 | ✅ Реализован |
| `apps/api/repositories/sheets_repo.py` | Google Sheets + кэш | ✅ Создан |
| `apps/api/main.py` | FastAPI с эндпоинтами данных | ✅ Обновлён |
| `.env` | Переменные окружения | ✅ Создан |
| `credentials.json` | Google Sheets credentials | ✅ Добавлен |
| `apps/web/lib/constants.ts` | Константы | ✅ Обновлён (PORTS_FROM добавлен) |
| `apps/web/lib/api.ts` | API клиент | ✅ Создан |
| `apps/web/components/FormInputs.tsx` | Форма с портами отправления | ✅ Обновлён (PORTS_FROM) |
| `apps/web/components/Calculator.tsx` | Интеграция с API | ✅ Обновлён |

---

## API Эндпоинты

| Метод | Путь | Описание | Статус |
|-------|------|----------|--------|
| GET | `/` | Приветствие | ✅ Работает |
| GET | `/health` | Проверка здоровья | ✅ Работает |
| GET | `/docs` | Swagger документация | ✅ Доступен |
| POST | `/calculate` | Расчёт себестоимости | ✅ Работает |
| GET | `/data/materials` | Список материалов | ✅ Работает |
| GET | `/data/parameters` | Параметры | ✅ Работает |
| GET | `/data/freight` | Данные по фрахту | ✅ Работает |
| GET | `/data/customs-fees` | Таможенные сборы | ✅ Работает |
| GET | `/data/city-port-map` | Город → порт | ✅ Работает |
| GET | `/data/car-delivery` | Доставка авто | ✅ Работает |
| GET | `/data/railway-delivery` | Доставка ЖД | ✅ Работает |
| GET | `/data/railway-car-delivery` | Доставка ЖД+авто | ✅ Работает |
| GET | `/data/all` | Все данные | ✅ Работает |
| POST | `/cache/invalidate` | Очистка кэша | ✅ Работает |

---

## Упоминания в планах

- План реализации: `PLAN_IMPLEMENTATION.md`
- PRD: /Users/danil/Documents/bot_pp/17.02/PRD.md
- Excel данные: `/Users/danil/Downloads/bot_python.xlsx`
- Google Sheets ID: `1zZ6bHIY21Ugq7nEJSCHcCRcP-ffxtjwifj9JpJk9Cek`

---

## Команды разработки

```bash
# Запуск всех сервисов
docker-compose up -d

# Перезапуск web
docker-compose restart web

# Перезапуск api
docker-compose restart api

# Просмотр логов
docker-compose logs -f
docker-compose logs api --tail 50

# Тест API
curl http://localhost:8000/data/materials
curl http://localhost:8000/data/all
curl -X POST "http://localhost:8000/cache/invalidate?sheet_name=Materials"

# Проверка кэша в Redis
docker-compose exec redis redis-cli KEYS "sheets:*"
```

---

## Заметки

### Frontend
- ✅ Frontend полностью работает на http://localhost:3000
- ✅ Все 3 вкладки переключаются корректно
- ✅ Адаптивность: Desktop (2 колонки), Mobile (1 колонка)
- ✅ Форма с react-hook-form + Zod validation работает
- ✅ Порт отправления содержит китайские порты: Dalian, Nansha, Ningbo, Qingdao, Shanghai, Yantian

### Backend
- ✅ Google Sheets API подключён (credentials.json)
- ✅ Правильный ID таблицы: `1zZ6bHIY21Ugq7nEJSCHcCRcP-ffxtjwifj9JpJk9Cek`
- ✅ Service account email: `python-api@pp-import-calculate.iam.gserviceaccount.com`
- ✅ Кэш через Redis работает (TTL 1 час)
- ✅ Парсинг процентов работает (6,50% → 0.065)
- ✅ PMMA duty = 0.13 (пользователь исправил в Sheets)

### Google Sheets
- ✅ 8 листов: Materials, parameters, fraht, tamozh_sbor, city-port, car, railways, railways-car
- 📝 Материалы содержат коды и пошлины
- 📝 Порты и города маппятся (CITY_PORT_MAP)
- 📝 ЖД станции зависят от порта

### Calculator1 - бизнес-логика
- ✅ Логика маршрутов работает:
  - Новороссийск/Санкт-Петербург → автодоставка
  - Владивосток → ЖД (прямая или со станцией)
- ✅ Обработка 40ftHC как 40 (в Sheets только 20 и 40)
- ✅ Обрезка пробелов в названиях материалов
- ✅ PMMA пошлина рассчитывается как EUR/кг × курс
- ✅ Обычная пошлина как % от таможенной стоимости
- ✅ Форматирование с разделителями тысяч
- ✅ Формат вывода соответствует эталону из `primer.md` (эмодзи, визуальные разделители)
- ⚠️ Санкт-Петербург добавлен в Sheets как дубликат (СПб → СПб)
- ⚠️ Нет фрахта Китай → Санкт-Петербург в данных Sheets

**Эталонный формат вывода:** `primer.md`

### Данные справочников
- Китайские порты отправления: Dalian, Nansha, Ningbo, Qingdao, Shanghai, Yantian
- Российские порты назначения: Новороссийск, Владивосток, Санкт-Петербург
- Размеры контейнеров в Sheets: 20, 40
- Материалы с пошлинами: 11 материалов
- Таможенные сборы: 7 диапазонов (min/max → fee)
