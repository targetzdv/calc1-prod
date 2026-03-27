from typing import Optional
from models.CalculatorRequest import CalculatorRequest
from models.CalculatorResponse import CalculatorResponse
from repositories.data_repo import reference_data_repo


def format_number(value: float, decimals: int = 2) -> str:
    """Форматирование числа с разделителями тысяч"""
    return f"{value:,.{decimals}f}"


def to_float(value: Optional[float]) -> float:
    """Безопасное приведение к float для значений из справочников."""
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def get_china_port_info(selected_port: str, port_cities: list[dict]) -> dict:
    """Собирает регионы и города по выбранному китайскому порту.

    Матчинг выполняется по столбцу `china_port_reg` (пункт 4 формы).
    """
    selected = selected_port.strip().lower()
    if not selected or not port_cities:
        return {
            "selected_port": selected_port,
            "matched_port": selected_port,
            "regions": [],
        }

    matched_rows = []
    for row in port_cities:
        row_port = str(row.get("china_port_reg", "")).strip()
        row_port_normalized = row_port.lower()
        if selected == row_port_normalized:
            matched_rows.append(row)

    if not matched_rows:
        return {
            "selected_port": selected_port,
            "matched_port": selected_port,
            "regions": [],
        }

    matched_port = str(matched_rows[0].get("china_port1", selected_port))
    regions_map: dict[str, list[str]] = {}
    for row in matched_rows:
        region = str(row.get("region", "")).strip()
        city = str(row.get("city_china", "")).strip()
        if not region or not city:
            continue
        regions_map.setdefault(region, [])
        if city not in regions_map[region]:
            regions_map[region].append(city)

    regions = [{"name": region, "cities": cities} for region, cities in regions_map.items()]
    return {
        "selected_port": selected_port,
        "matched_port": matched_port,
        "regions": regions,
    }


def calculate(request: CalculatorRequest) -> CalculatorResponse:
    """
    Калькулятор 1 - расчёт себестоимости поставки
    """
    # === 1. Получение справочных данных ===
    all_data = reference_data_repo.get_all_data()

    # Параметры
    params = all_data['parameters']
    course_cny_to_rub = params['course_cny_to_rub']
    course_usd_to_rub = params['course_usd_to_rub']
    course_eur_to_rub = params['course_eur_to_rub']
    nds_percent = params['nds_percent']
    broker_fee_fixed = params['broker_fee_fixed']
    bank_commission_percent = params['bank_commission_percent']

    # Материалы
    materials = all_data['materials']
    material = next((m for m in materials if m['material'].strip() == request.material.strip()), None)

    if material is None:
        return CalculatorResponse(
            result="Ошибка: Материал не найден",
            raw_data={"error": f"Материал {request.material} не найден в справочнике"}
        )

    duty_rate = material['duty'] or 0.0
    calculation_type = material['calculation_type']

    # Город → Порт маппинг
    city_port_map = all_data['city_port_map']

    # Особый случай для Санкт-Петербурга (он сам является портом)
    if request.city_to == "Санкт-Петербург":
        port_to = "Санкт-Петербург"
    else:
        port_to = city_port_map.get(request.city_to)

    if port_to is None:
        return CalculatorResponse(
            result="Ошибка: Город назначения не найден",
            raw_data={"error": f"Город {request.city_to} не найден в справочнике"}
        )

    # Фрахт
    freight_data = all_data['freight']
    container_size_num = '40' if request.container_size == '40ft' else '20'

    freight = next(
        (f for f in freight_data
         if f['point_a'] == request.port_from
         and f['point_b'] == port_to
         and f['container'] == container_size_num),
        None
    )

    if freight is None:
        return CalculatorResponse(
            result="Ошибка: Фрахт не найден",
            raw_data={
                "error": f"Фрахт не найден для маршрута {request.port_from} → {port_to}, контейнер {request.container_size}"
            }
        )

    freight_usd = to_float(freight.get('freight_usd'))

    # === 2. Финансовые расчёты ===

    # 1. Сумма закупки (CNY)
    purchase_sum_cny = request.price_per_kg * request.quantity

    # 2. Сумма закупки (RUB)
    purchase_sum_rub = purchase_sum_cny * course_cny_to_rub

    # 3. Фрахт (RUB)
    freight_rub = freight_usd * course_usd_to_rub

    # 4. Таможенная стоимость (RUB)
    customs_value_rub = purchase_sum_rub + freight_rub

    # 5. Пошлина (RUB) - особая логика для PMMA
    if calculation_type == 'pmma':
        # PMMA: количество (кг) × ставка EUR/кг × курс EUR→RUB
        duty_rub = request.quantity * duty_rate * course_eur_to_rub
    else:
        # Обычные материалы: таможенная стоимость × duty (уже в десятичном формате 0.065 = 6.5%)
        duty_rub = customs_value_rub * duty_rate

    # 6. Таможенный сбор (RUB) - по диапазону
    customs_fees = all_data['customs_fees']
    customs_fee = next(
        (f['fee'] for f in customs_fees
         if f['min'] <= customs_value_rub <= f['max']),
        customs_fees[-1]['fee'] if customs_fees else 1231  # fallback
    )

    # 7. НДС (RUB)
    vat_rub = (customs_value_rub + duty_rub) * (nds_percent / 100.0)

    # 8. Брокер (RUB)
    broker_rub = broker_fee_fixed

    # 9. Вывоз/доставка (RUB) - по ветке маршрута
    # Ветка: Новороссийск/СПб → авто, Владивосток → ЖД
    if port_to in ['Новороссийск', 'Санкт-Петербург']:
        # Автодоставка
        # Особый случай: если город назначения == порт назначения (СПб → СПб), доставки нет
        if request.city_to == port_to:
            delivery_rub = 0.0
            delivery_type = "Не требуется (город = порт)"
        else:
            car_delivery = all_data['car_delivery']
            delivery = next(
                (d for d in car_delivery
                     if d['port'] == port_to
                     and d['city'] == request.city_to
                     and d['container'] == container_size_num),
                None
            )

            if delivery is None:
                delivery_rub = 0.0
                delivery_type = f"Авто (не найден маршрут {port_to} → {request.city_to})"
            else:
                delivery_rub = to_float(delivery.get('price'))
                delivery_type = "Авто"
    else:  # Владивосток → ЖД
        railway_delivery = all_data['railway_delivery']
        station = request.railway_station

        if station:
            # Есть станция - суммируем ЖД от порта до станции + ЖД+авто от станции до города
            railway_car_delivery = all_data['railway_car_delivery']
            railway = next(
                (d for d in railway_delivery
                 if d['port'] == port_to
                 and d['station'].lower() == station.lower()
                 and d['container'] == container_size_num),
                None
            )
            railway_car = next(
                (d for d in railway_car_delivery
                 if d['station'].lower() == station.lower()
                 and d['city'] == request.city_to
                 and d['container'] == container_size_num),
                None
            )

            railway_rub = to_float(railway.get('price')) if railway else 0.0
            railway_car_rub = to_float(railway_car.get('price')) if railway_car else 0.0
            delivery_rub = railway_rub + railway_car_rub
            delivery_type = "ЖД"
            railway_station_used = station
        else:
            # Станция не выбрана - ищем прямую ЖД от порта
            railway = next(
                (d for d in railway_delivery
                 if d['port'] == port_to
                 and d['station'] == request.city_to
                 and d['container'] == container_size_num),
                None
            )

            railway_rub = 0.0
            railway_car_rub = 0.0
            if railway:
                delivery_rub = to_float(railway.get('price'))
                delivery_type = "ЖД"
            else:
                delivery_rub = 0.0
                delivery_type = f"ЖД (не найден маршрут {port_to} → {request.city_to})"
            railway_station_used = request.city_to

    # 10. Банковская комиссия (RUB)
    bank_fee_rub = purchase_sum_rub * (bank_commission_percent / 100.0)

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

    # === 3. Формирование результата ===

    raw_data = {
        "calculator_type": 1,
        "input": {
            "material": request.material,
            "port_from": request.port_from,
            "city_to": request.city_to,
            "port_to": port_to,
            "railway_station": request.railway_station or "-",
            "quantity": request.quantity,
            "container_size": request.container_size,
            "price_per_kg": request.price_per_kg,
        },
        "intermediate": {
            "purchase_sum_cny": purchase_sum_cny,
            "purchase_sum_rub": purchase_sum_rub,
            "freight_usd": freight_usd,
            "freight_rub": freight_rub,
            "customs_value_rub": customs_value_rub,
            "duty_rub": duty_rub,
            "customs_fee_rub": customs_fee,
            "vat_rub": vat_rub,
            "broker_rub": broker_rub,
            "delivery_rub": delivery_rub,
            "delivery_type": delivery_type,
            "bank_fee_rub": bank_fee_rub,
            "railway_rub": railway_rub if 'railway_rub' in locals() else 0.0,
            "railway_car_rub": railway_car_rub if 'railway_car_rub' in locals() else 0.0,
            "railway_station_used": railway_station_used if 'railway_station_used' in locals() else "",
        },
        "china_port_info": get_china_port_info(
            request.port_from,
            all_data.get("china_port_cities", []),
        ),
        "result": {
            "total_cost_rub": total_cost_rub,
            "cost_per_kg": cost_per_kg,
        },
    }

    # Формируем маршрут для ЖД (включает станцию, если есть)
    if delivery_type == "ЖД" and request.railway_station:
        route = f"{request.port_from} → {port_to} → {request.railway_station} → {request.city_to}"
    else:
        route = f"{request.port_from} → {port_to} → {request.city_to}"

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
3️⃣ Таможенная стоимость: {format_number(customs_value_rub)} ₽
4️⃣ Пошлина: {format_number(duty_rub)} ₽
5️⃣ Таможенный сбор: {format_number(customs_fee)} ₽
6️⃣ НДС ({nds_percent}%): {format_number(vat_rub)} ₽
7️⃣ Брокер: {format_number(broker_rub)} ₽
{delivery_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 ПОЛНАЯ СЕБЕСТОИМОСТЬ: {format_number(total_cost_rub)} ₽ с НДС
💎 За 1 кг: {format_number(cost_per_kg)} ₽/кг с НДС
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    return CalculatorResponse(result=result, raw_data=raw_data)
