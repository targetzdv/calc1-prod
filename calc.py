# calculator.py (ФИНАЛЬНАЯ ВЕРСИЯ v2.0 FIX - 2026-01-13)
from google_sheets import sheets_client


class Calculator:
    def __init__(self, material_name):
        """Инициализирует калькулятор для материала"""
        self.sheets_client = sheets_client
        materials = sheets_client.load_materials()

        # Ищем материал по имени
        self.material = None
        for mat in materials:
            if mat["material"].lower() == material_name.lower():
                self.material = mat
                break

        if not self.material:
            raise ValueError(f"Материал '{material_name}' не найден в Google Sheets")

        # Загружаем параметры один раз при инициализации
        self.params = sheets_client.load_parameters()

    def calculate(
        self,
        freight_usd,
        quantity_kg,
        price_rmb_kg,
        delivery_cost_rub=0,
        delivery_railway_to_station=0,
        delivery_station_to_city=0,
    ):
        """
        Рассчитывает себестоимость с пошаговым расчётом

        Поддерживает 3 типа маршрутов:
        1. НОВОРОССИЙСК: использует delivery_cost_rub (авто доставка)
        2. ВЛАДИВОСТОК: использует delivery_railway_to_station + delivery_station_to_city (ЖД + авто)
        3. ФИКСИРОВАННЫЙ: использует export_fee_fixed из параметров (старый режим)

        Порядок: Тамож. стоим. + Пошлина + Тамож. сбор + НДС + Брокер + [Доставка] + Комиссия

        ФОРМУЛЫ:
        1. Закупка (RMB → RUB): кол-во × цена RMB/кг × курс RMB/RUB
        2. Фрахт (USD → RUB): фрахт USD × курс USD/RUB
        3. Таможенная стоимость: Закупка + Фрахт
        4. Пошлина:
           - PMMA: кол-во кг × ставка EUR/кг × курс EUR/RUB
           - NORMAL: Таможенная стоимость × % пошлины
        5. Таможенный сбор: по таблице от Таможенной стоимости
        6. НДС: (Таможенная стоимость + Пошлина) × 22%
        7. Брокер: фиксированная сумма из параметров
        8. Доставка (одна из трех вариантов):
           - del_car: авто доставка для маршрута Новороссийск
           - del_to_city_railways: ЖД доставка для маршрута Владивосток
           - export_fee_fixed: фиксированная сумма (старый режим)
        9. Банк комиссия: Закупка (RUB) × 5%

        Финальная себестоимость: Сумма всех компонентов выше

        Args:
            freight_usd (float): Стоимость фрахта в USD
            quantity_kg (float): Количество товара в кг
            price_rmb_kg (float): Цена за кг в RMB
            delivery_cost_rub (float): Стоимость авто доставки (для Новороссийска)
            delivery_railway_to_station (float): Стоимость ЖД доставки до станции (для Владивостока)
            delivery_station_to_city (float): Стоимость доставки от станции до города (для Владивостока)

        Returns:
            dict: Словарь со всеми расчётными показателями
        """

        params = self.params

        # ========== ШАГ 1: ЗАКУПКА (RMB → RUB) ==========
        procurement_rub = quantity_kg * price_rmb_kg * params["course_cny_to_rub"]

        # ========== ШАГ 2: ФРАХТ (USD → RUB) ==========
        freight_rub = freight_usd * params["course_usd_to_rub"]

        # ========== ШАГ 3: ТАМОЖЕННАЯ СТОИМОСТЬ ==========
        customs_value_rub = procurement_rub + freight_rub

        # ========== ШАГ 4: ПОШЛИНА ==========
        if self.material["calculation_type"] == "pmma":
            # PMMA: пошлина считается за килограмм в EUR
            duty_amount = (
                quantity_kg * self.material["duty"] * params["course_eur_to_rub"]
            )
        else:
            # NORMAL: пошлина считается в процентах от таможенной стоимости
            duty_percent = self.material["duty"] / 100.0
            duty_amount = customs_value_rub * duty_percent

        # ========== ШАГ 5: ТАМОЖЕННЫЙ СБОР ==========
        # Сбор зависит от таможенной стоимости
        customs_fee = self.sheets_client.find_duty(customs_value_rub)

        # ========== ШАГ 6: НДС (БАЗА: Таможенная стоимость + Пошлина) ==========
        nds_base = customs_value_rub + duty_amount
        nds_percent = params["nds_percent"] / 100.0
        nds_amount = nds_base * nds_percent

        # ========== ШАГ 7: БРОКЕР (фиксированная сумма) ==========
        broker_fee = params["broker_fee_fixed"]

        # ========== ШАГ 8: ДОСТАВКА (выбираем нужный вариант) ==========
        # Логика определения типа доставки:
        # 1. Если передана delivery_cost_rub > 0 → маршрут НОВОРОССИЙСК (авто доставка)
        # 2. Если передана delivery_railway_to_station > 0 или delivery_station_to_city > 0 → маршрут ВЛАДИВОСТОК (ЖД)
        # 3. Иначе используем export_fee_fixed из параметров (старый режим для совместимости)

        if delivery_cost_rub > 0:
            # ✅ Маршрут НОВОРОССИЙСК: только авто доставка
            del_car = delivery_cost_rub
            del_to_station = 0
            del_station_to_city = 0
            del_to_city_railways = 0
            export_fee = del_car
            route_type = "car"  # ← Добавляем тип маршрута
        elif delivery_railway_to_station > 0 or delivery_station_to_city > 0:
            # ✅ Маршрут ВЛАДИВОСТОК: ЖД доставка (до станции + от станции до города)
            del_to_station = delivery_railway_to_station
            del_station_to_city = delivery_station_to_city
            del_to_city_railways = del_to_station + del_station_to_city
            del_car = 0
            export_fee = del_to_city_railways
            route_type = "railway"  # ← Добавляем тип маршрута
        else:
            # ✅ Старый режим: используем fixed export fee из параметров
            export_fee = params.get("export_fee_fixed", 0)
            del_car = 0
            del_to_station = 0
            del_station_to_city = 0
            del_to_city_railways = 0
            route_type = "fixed"  # ← Добавляем тип маршрута

        # ========== ШАГ 9: БАНКОВСКАЯ КОМИССИЯ (5% от Закупки RUB) ==========
        bank_commission_percent = params["bank_commission_percent"] / 100.0
        bank_commission = procurement_rub * bank_commission_percent

        # ========== ШАГ 10: ФИНАЛЬНАЯ СЕБЕСТОИМОСТЬ ==========
        total_cost = (
            customs_value_rub  # Таможенная стоимость
            + duty_amount  # Пошлина
            + customs_fee  # Таможенный сбор
            + nds_amount  # НДС
            + broker_fee  # Брокер
            + export_fee  # Доставка (выбранный вариант)
            + bank_commission  # Банк комиссия
        )

        final_cost_per_kg = total_cost / quantity_kg

        # ========== ВОЗВРАЩАЕМ ВСЕ ЗНАЧЕНИЯ ==========
        results = {
            "procurement_rub": procurement_rub,
            "freight_rub": freight_rub,
            "customs_value_rub": customs_value_rub,
            "duty_amount": duty_amount,
            "customs_fee": customs_fee,
            "nds_amount": nds_amount,
            "broker_fee": broker_fee,
            "export_fee": export_fee,  # ✅ ДОБАВЛЕНО: базовая переменная доставки
            "bank_commission": bank_commission,
            "total_cost": total_cost,
            "final_cost_per_kg": final_cost_per_kg,
            "quantity_kg": quantity_kg,
            "route_type": route_type,  # ✅ ДОБАВЛЕНО: тип маршрута (для хендлера)
        }

        # ✅ ИСПРАВЛЕНО: Добавляем переменные доставки в зависимости от типа маршрута
        if route_type == "car":
            # Маршрут Новороссийск - авто доставка
            results["del_car"] = del_car
        elif route_type == "railway":
            # Маршрут Владивосток - ЖД доставка
            results["del_to_station"] = del_to_station
            results["del_station_to_city"] = del_station_to_city
            results["del_to_city_railways"] = del_to_city_railways
        # Для 'fixed' режима используется export_fee (уже добавлен выше)

        return results
