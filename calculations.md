# Файлы, отвечающие за расчёты и вывод результата

## ⚙️ Бизнес-логика Calculator1

| Файл | Отвечает за |
|-------|--------------|
| `apps/api/calculators/calculator1.py` | **Основной файл расчётов** - все формулы, маршруты, формат вывода результата |

---

## 📦 Структура calculator1.py

### 1. Функция форматирования чисел (строка ~7-9)
```python
def format_number(value: float, decimals: int = 2) -> str:
    """Форматирование числа с разделителями тысяч"""
    return f"{value:,.{decimals}f}"
```

**Что делает:** Добавляет разделители тысяч (например, `1000000` → `1,000,000.00`)

---

### 2. Получение справочных данных (строки ~16-27)
```python
# Получение данных из Google Sheets (с кэшем Redis)
all_data = sheets_repo.get_all_data()

# Параметры
course_cny_to_rub = params['course_cny_to_rub']
course_usd_to_rub = params['course_usd_to_rub']
course_eur_to_rub = params['course_eur_to_rub']
nds_percent = params['nds_percent']
broker_fee_fixed = params['broker_fee_fixed']
bank_commission_percent = params['bank_commission_percent']
```

**Что делает:** Загружает курсы валют, НДС, брокера, банковскую комиссию из Google Sheets

---

### 3. Определение маршрута (строки ~41-54)
```python
# Маппинг город → порт
city_port_map = all_data['city_port_map']

# Особый случай для Санкт-Петербурга (он сам является портом)
if request.city_to == "Санкт-Петербург":
    port_to = "Санкт-Петербург"
else:
    port_to = city_port_map.get(request.city_to)
```

**Что делает:** Определяет порт назначения в РФ по городу назначения

---

### 4. Поиск фрахта (строки ~57-77)
```python
# Обрабатываем 40ftHC как 40 (в Sheets только 20 и 40)
container_size_num = '40' if '40' in request.container_size else '20'

# Поиск фрахта в таблице
freight = next(
    (f for f in freight_data
     if f['point_a'] == request.port_from
     and f['point_b'] == port_to
     and f['container'] == container_size_num),
    None
)
```

**Что делает:** Находит стоимость фрахта из Китая в порт РФ по маршруту и размеру контейнера

---

### 5. Расчёты по этапам (строки ~81-197)

#### Закупка (строки ~82-85)
```python
# 1. Сумма закупки (CNY)
purchase_sum_cny = request.price_per_kg * request.quantity

# 2. Сумма закупки (RUB)
purchase_sum_rub = purchase_sum_cny * course_cny_to_rub
```

#### Фрахт (строки ~87-88)
```python
# 3. Фрахт (RUB)
freight_rub = freight_usd * course_usd_to_rub
```

#### Таможенная стоимость (строки ~90-91)
```python
# 4. Таможенная стоимость (RUB)
customs_value_rub = purchase_sum_rub + freight_rub
```

#### Пошлина (строки ~93-100)
```python
# 5. Пошлина (RUB) - особая логика для PMMA
if calculation_type == 'pmma':
    # PMMA: количество (кг) × ставка EUR/кг × курс EUR→RUB
    duty_rub = request.quantity * duty_rate * course_eur_to_rub
else:
    # Обычные материалы: таможенная стоимость × (duty / 100)
    duty_rub = customs_value_rub * (duty_rate / 100.0)
```

#### Таможенный сбор (строки ~102-108)
```python
# 6. Таможенный сбор (RUB) - по диапазону
customs_fee = next(
    (f['fee'] for f in customs_fees
     if f['min'] <= customs_value_rub <= f['max']),
    customs_fees[-1]['fee'] if customs_fees else 1231  # fallback
)
```

#### НДС (строки ~110-111)
```python
# 7. НДС (RUB)
vat_rub = (customs_value_rub + duty_rub) * (nds_percent / 100.0)
```

#### Брокер (строки ~113-114)
```python
# 8. Брокер (RUB)
broker_rub = broker_fee_fixed
```

#### Доставка (строки ~116-185)
```python
# Ветка: Новороссийск/СПб → авто, Владивосток → ЖД

if port_to in ['Новороссийск', 'Санкт-Петербург']:
    # Автодоставка
    # Особый случай: если город назначения == порт назначения (СПб → СПб), доставки нет
    if request.city_to == port_to:
        delivery_rub = 0.0
    else:
        # Поиск цены автодоставки
        delivery = next((d for d in car_delivery ...), None)
        delivery_rub = delivery['price']
else:  # Владивосток → ЖД
    if station:
        # Есть станция - суммируем ЖД от порта до станции + ЖД+авто от станции до города
        railway_rub = railway['price']
        railway_car_rub = railway_car['price']
        delivery_rub = railway_rub + railway_car_rub
    else:
        # Станция не выбрана - прямая ЖД от порта
        delivery_rub = railway['price']
```

#### Банковская комиссия (строки ~182)
```python
# 10. Банковская комиссия (RUB)
bank_fee_rub = purchase_sum_rub * (bank_commission_percent / 100.0)
```

#### Полная себестоимость и за 1 кг (строки ~184-196)
```python
# 11. Полная себестоимость партии (RUB)
total_cost_rub = (
    customs_value_rub
    + duty_rub
    + customs_fee
    + vat_rub
    + broker_rub
    + delivery_rub
    + bank_fee_rub
)

# 12. Себестоимость за 1 кг (RUB/кг)
cost_per_kg = total_cost_rub / request.quantity
```

---

### 6. Формирование результата (строки ~240-290)

#### Маршрут (строки ~246-248)
```python
# Формируем маршрут для ЖД (включает станцию, если есть)
if delivery_type == "ЖД" and request.railway_station:
    route = f"{request.port_from} → {port_to} → {request.railway_station} → {request.city_to}"
else:
    route = f"{request.port_from} → {port_to} → {request.city_to}"
```

#### Блок доставки (строки ~250-266)
```python
# Формируем блок доставки
if delivery_type == "ЖД" and request.railway_station:
    # ЖД с выбранной станцией - две отдельные строки
    delivery_block = f"""8️⃣ Доставка по ЖД в РФ: {format_number(railway_rub)} ₽
9️⃣ Доставка от ЖД до Склада в РФ: {format_number(railway_car_rub)} ₽
🔟 Банковская комиссия ({bank_commission_percent}%): {format_number(bank_fee_rub)} ₽"""
else:
    # Авто или прямая ЖД - одна строка доставки
    delivery_block = f"""8️⃣ Доставка с порта на склад в РФ ({delivery_type}): {format_number(delivery_rub)} ₽
9️⃣ Банковская комиссия ({bank_commission_percent}%): {format_number(bank_fee_rub)} ₽"""
```

#### Полный вывод (строки ~268-290)
```python
result = f"""📊 РЕЗУЛЬТАТЫ РАСЧЁТА
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 Входные данные:
📦 Материал: {request.material}
🚢 Маршрут: {route}
📏 Контейнер: {request.container_size}
📊 Количество: {format_number(request.quantity)} кг
💰 Цена: {format_number(request.price_per_kg)} ¥/кг
✈️ Фрахт: {format_number(freight_usd)} USD

📋 Расчёты по этапам:
1️⃣ Закупка (RUB): {format_number(purchase_sum_rub)} ₽
2️⃣ Фрахт (RUB): {format_number(freight_rub)} ₽
...
"""
```

---

## 📊 Структура ответа API (raw_data)

| Секция | Поля |
|---------|-------|
| `input` | material, port_from, city_to, port_to, railway_station, quantity, container_size, price_per_kg |
| `intermediate` | purchase_sum_cny, purchase_sum_rub, freight_usd, freight_rub, customs_value_rub, duty_rub, customs_fee_rub, vat_rub, broker_rub, delivery_rub, delivery_type, bank_fee_rub, railway_rub, railway_car_rub, railway_station_used |
| `result` | total_cost_rub, cost_per_kg |

---

## 📝 Документация формул

| Файл | Описание |
|-------|----------|
| `formules.md` | Полное описание математических формул для всех этапов расчёта |
| `primer.md` | Эталонный формат вывода результата (для автотестов) |

---

## 🔄 Где изменить формулы

### Изменить формулу расчёта пошлины
```python
# apps/api/calculators/calculator1.py (строки ~94-100)
# PMMA или обычная пошлина
if calculation_type == 'pmma':
    duty_rub = request.quantity * duty_rate * course_eur_to_rub
else:
    duty_rub = customs_value_rub * (duty_rate / 100.0)
```

### Изменить формулу НДС
```python
# apps/api/calculators/calculator1.py (строка ~111)
vat_rub = (customs_value_rub + duty_rub) * (nds_percent / 100.0)
```

### Изменить логику маршрутов
```python
# apps/api/calculators/calculator1.py (строки ~116-185)
# Добавить/изменить условия для определения типа доставки
if port_to in ['Новороссийск', 'Санкт-Петербург']:
    # Автодоставка
else:  # Владивосток → ЖД
    # ЖД логика
```

### Изменить формат вывода
```python
# apps/api/calculators/calculator1.py (строки ~240-290)
# Добавить/убрать эмодзи, изменить текст, изменить порядок строк
result = f"""..."""
```

---

## 🔧 Отладка расчётов

### Проверить промежуточные значения
```bash
curl -X POST "http://localhost:8000/calculate" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq '.raw_data.intermediate'
```

### Проверить входные данные
```bash
curl -X POST "http://localhost:8000/calculate" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq '.raw_data.input'
```

### Проверить финальный результат
```bash
curl -X POST "http://localhost:8000/calculate" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq '.raw_data.result'
```

---

## 📋 Другие калькуляторы

| Файл | Статус |
|-------|--------|
| `apps/api/calculators/calculator2.py` | Заглушка (возвращает тестовые данные) |
| `apps/api/calculators/calculator3.py` | Заглушка (возвращает тестовые данные) |
