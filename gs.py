# google_sheets.py (ИСПРАВЛЕННАЯ И ПРОВЕРЕННАЯ ВЕРСИЯ v2.7 - 2026-01-16)
import re

from config import CREDENTIALS_PATH, SHEET_ID
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


class GoogleSheetsClient:
    def __init__(self):
        credentials = Credentials.from_service_account_file(
            CREDENTIALS_PATH, scopes=SCOPES
        )
        self.service = build("sheets", "v4", credentials=credentials)

    def load_materials(self):
        """Загружает материалы из листа Materials"""
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="Materials!A2:D100")
            .execute()
        )

        materials = []
        for row in result.get("values", []):
            if len(row) >= 4:
                duty_str = str(row[2]).replace("%", "").replace(",", ".").strip()
                materials.append(
                    {
                        "material": row[0],
                        "kod": row[1],
                        "duty": float(duty_str),
                        "calculation_type": row[3].lower().strip(),
                    }
                )
        return materials

    def load_parameters(self):
        """Загружает параметры из листа parameters"""
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="parameters!A2:B100")
            .execute()
        )

        params = {}
        for row in result.get("values", []):
            if len(row) >= 2:
                # Преобразуем ключ: "course USD to RUB" → "course_usd_to_rub"
                key = row[0].lower().strip().replace(" ", "_")

                try:
                    # Пытаемся преобразовать значение в число
                    value_str = str(row[1]).strip().replace(",", ".")
                    params[key] = float(value_str)
                except (ValueError, AttributeError):
                    # Если не число - оставляем строку как есть
                    params[key] = row[1]

        return params

    def load_freights(self):
        """Загружает маршруты и фрахт из листа fraht"""
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="fraht!A2:D100")
            .execute()
        )

        freights = []
        for row in result.get("values", []):
            if len(row) >= 4:
                # ✅ ИСПРАВЛЕНИЕ: Нормализуем контейнер
                container = self._normalize_container(row[2])

                freights.append(
                    {
                        "point_a": row[0].strip(),
                        "point_b": row[1].strip(),
                        "container": container,
                        "freight_usd": float(str(row[3]).replace(",", ".")),
                    }
                )
        return freights

    def load_duties(self):
        """Загружает таможенные сборы из листа tamozh_sbor"""
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="tamozh_sbor!A2:C100")
            .execute()
        )

        duties = []
        for row in result.get("values", []):
            if len(row) < 2:
                continue

            try:
                # Min - парсим с удалением ВСЕх пробелов
                min_val_str = re.sub(r"[\s\xa0]+", "", str(row[0]))
                if not min_val_str:
                    continue
                min_val = int(float(min_val_str.replace(",", ".")))

                # Max - может быть пустым
                if len(row) >= 2 and str(row[1]).strip():
                    max_val_str = re.sub(r"[\s\xa0]+", "", str(row[1]))
                    max_val = int(float(max_val_str.replace(",", ".")))
                else:
                    max_val = 999999999

                # Fee - требуется всегда
                if len(row) >= 3 and str(row[2]).strip():
                    fee_str = re.sub(r"[\s\xa0]+", "", str(row[2]))
                    fee_val = int(float(fee_str.replace(",", ".")))
                else:
                    continue

                duties.append({"min": min_val, "max": max_val, "fee": fee_val})

            except (ValueError, AttributeError, IndexError) as e:
                print(f"⚠️ Пропущена строка таможенного сбора (ошибка: {e})")
                continue

        return duties

    # ═══════════════════════════════════════════════════════════
    # МЕТОДЫ ЗАГРУЗКИ ТАБЛИЦ
    # ═══════════════════════════════════════════════════════════

    def load_city_port(self):
        """Загружает связи город-порт из листа city-port

        Range: city-port!A2:B100
        Структура: City | Port
        """
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="city-port!A2:B100")
            .execute()
        )

        city_port = []
        seen = set()  # ✅ ИСПРАВЛЕНИЕ: отслеживаем дубликаты

        for row in result.get("values", []):
            if len(row) >= 2:
                city = row[0].strip()
                port = row[1].strip()

                # ✅ ИСПРАВЛЕНИЕ: пропускаем дубликаты пар город-порт
                pair_key = (city.lower(), port.lower())
                if pair_key not in seen:
                    city_port.append({"city": city, "port": port})
                    seen.add(pair_key)

        return city_port

    def load_railways(self):
        """Загружает маршруты по ЖД из листа railways

        Range: railways!A2:D100
        Структура: Port | Station | Container | Price
        """
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="railways!A2:D100")
            .execute()
        )

        railways = []
        for row in result.get("values", []):
            if len(row) >= 4:
                try:
                    # ✅ ИСПРАВЛЕНИЕ: Нормализуем контейнер
                    container = self._normalize_container(row[2])

                    railways.append(
                        {
                            "port": row[0].strip(),
                            "station": row[1].strip(),
                            "container": container,
                            "price": float(str(row[3]).replace(",", ".")),
                        }
                    )
                except (ValueError, AttributeError):
                    print(f"⚠️ Пропущена строка ЖД маршрута: {row}")
                    continue
        return railways

    def load_railways_car(self):
        """Загружает доставку от станции до города из листа railways-car

        Range: railways-car!A2:D100
        Структура: Station | City | Container | Price
        """
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="railways-car!A2:D100")
            .execute()
        )

        railways_car = []
        for row in result.get("values", []):
            if len(row) >= 4:
                try:
                    # ✅ ИСПРАВЛЕНИЕ: Нормализуем контейнер
                    container = self._normalize_container(row[2])

                    railways_car.append(
                        {
                            "station": row[0].strip(),
                            "city": row[1].strip(),
                            "container": container,
                            "price": float(str(row[3]).replace(",", ".")),
                        }
                    )
                except (ValueError, AttributeError):
                    print(f"⚠️ Пропущена строка доставки от станции: {row}")
                    continue
        return railways_car

    def load_car(self):
        """Загружает доставку авто из портов из листа car

        Range: car!A2:D100
        Структура: Port | City | Container | Price
        """
        result = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range="car!A2:D100")
            .execute()
        )

        car = []
        for row in result.get("values", []):
            if len(row) >= 4:
                try:
                    # ✅ ИСПРАВЛЕНИЕ: Нормализуем контейнер
                    container = self._normalize_container(row[2])

                    car.append(
                        {
                            "port": row[0].strip(),
                            "city": row[1].strip(),
                            "container": container,
                            "price": float(str(row[3]).replace(",", ".")),
                        }
                    )
                except (ValueError, AttributeError):
                    print(f"⚠️ Пропущена строка авто доставки: {row}")
                    continue
        return car

    # ═══════════════════════════════════════════════════════════
    # ВСПОМОГАТЕЛЬНЫЙ МЕТОД НОРМАЛИЗАЦИИ КОНТЕЙНЕРА
    # ═══════════════════════════════════════════════════════════

    def _normalize_container(self, container_value):
        """✅ КРИТИЧЕСКИЙ МЕТОД: Нормализует размер контейнера в строку

        Преобразует любой формат контейнера в строку:
        - 20 → "20"
        - 20.0 → "20"
        - "20" → "20"
        - "20 ft" → "20"
        - " 20 " → "20"

        ✅ ИСПРАВЛЕНИЕ v2.6: обрабатывает пустые строки!

        Args:
            container_value: Значение контейнера в любом формате

        Returns:
            str: Нормализованная строка контейнера (например "20" или "40")
            или "unknown" если не удалось нормализовать
        """
        try:
            # Преобразуем в строку и удаляем пробелы
            container_str = str(container_value).strip()

            # ✅ ИСПРАВЛЕНИЕ: проверяем на пустую строку ДО обработки
            if not container_str:
                print(f"⚠️ Пустой контейнер в данных")
                return "unknown"

            # Удаляем "ft" или "фт" если есть
            container_str = container_str.replace("ft", "").replace("фт", "").strip()

            # Преобразуем в число и обратно в строку
            # Это обрабатывает: "20.0" → 20.0 → 20 → "20"
            container_int = int(float(container_str))

            return str(container_int)
        except (ValueError, TypeError, AttributeError):
            # Если не удалось нормализовать - логируем и возвращаем unknown
            print(f"⚠️ Не удалось нормализовать контейнер: {container_value}")
            return "unknown"

    # ═══════════════════════════════════════════════════════════
    # НОВЫЕ МЕТОДЫ ЛОГИКИ
    # ═══════════════════════════════════════════════════════════

    def get_all_cities_from_port(self):
        """✅ НОВЫЙ МЕТОД v2.5: Получает все города с разделением по портам

        Возвращает словарь, где ключ - порт РФ, значение - список городов

        Returns:
            dict: {порт: [список городов]}

        Пример:
            result = sheets_client.get_all_cities_from_port()
            # Возвращает: {
            #     "Новороссийск": ["Москва", "Краснодар", ...],
            #     "Владивосток": ["Ярославль", "Иркутск", ...]
            # }
        """
        city_port_data = self.load_city_port()
        ports_cities = {}

        for item in city_port_data:
            port = item["port"]
            city = item["city"]

            # Инициализируем порт если его нет
            if port not in ports_cities:
                ports_cities[port] = []

            # Добавляем город (дубликаты уже исключены в load_city_port)
            if city not in ports_cities[port]:
                ports_cities[port].append(city)

        # Сортируем города в каждом порту
        for port in ports_cities:
            ports_cities[port] = sorted(ports_cities[port])

        if not ports_cities:
            print("⚠️ Города в листе city-port не найдены")

        return ports_cities

    def get_ports_by_city(self, city):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Получает ВСЕ порты для города

        Находит в листе city-port все порты для выбранного города.

        Args:
            city (str): Название города (например "Ярославль")

        Returns:
            list: Список портов РФ (например ["Владивосток"]) или пустой список

        Пример:
            ports = sheets_client.get_ports_by_city("Ярославль")
            # Возвращает: ["Владивосток"]
        """
        city_port_data = self.load_city_port()
        ports = []
        seen = set()

        for item in city_port_data:
            if item["city"].lower() == city.lower():
                port = item["port"]
                if port.lower() not in seen:
                    ports.append(port)
                    seen.add(port.lower())

        if not ports:
            print(f"⚠️ Порты для города '{city}' не найдены в city-port")

        return sorted(ports)

    def get_chinese_ports_by_rf_port(self, rf_port):
        """✅ НОВЫЙ МЕТОД v2.5: Получает портов Китая для порта РФ

        На основе листа fraht находит все китайские порты (point_a),
        которые направлены в конкретный российский порт (point_b).

        Args:
            rf_port (str): Название российского порта (например "Владивосток")

        Returns:
            list: Список уникальных китайских портов

        Пример:
            chinese_ports = sheets_client.get_chinese_ports_by_rf_port("Владивосток")
            # Возвращает: ["Shanghai", "Ningbo", "Qingdao", "Yantian"]
        """
        freights = self.load_freights()
        chinese_ports = []
        seen = set()

        for freight in freights:
            # Ищем все маршруты, которые идут в конкретный русский порт
            if freight["point_b"].strip().lower() == rf_port.strip().lower():
                point_a = freight["point_a"].strip()

                # Добавляем уникальные портов Китая
                if point_a.lower() not in seen:
                    chinese_ports.append(point_a)
                    seen.add(point_a.lower())

        if not chinese_ports:
            print(f"⚠️ Китайские порты для маршрута в {rf_port} не найдены в fraht")

        return sorted(chinese_ports)

    # ═══════════════════════════════════════════════════════════
    # СУЩЕСТВУЮЩИЕ МЕТОДЫ (ИСПРАВЛЕННЫЕ)
    # ═══════════════════════════════════════════════════════════

    def get_cities_by_port(self, port):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Получает города для конкретного порта

        Теперь использует кэш из get_all_cities_from_port для избежания дублирования логики.

        Args:
            port (str): Название порта (Владивосток, Новороссийск)

        Returns:
            list: Список городов, которые доступны для этого порта
        """
        all_cities = self.get_all_cities_from_port()
        cities = all_cities.get(port, [])

        if not cities:
            print(f"⚠️ Города для порта '{port}' не найдены в city-port")

        return cities

    def get_stations_by_city(self, city):
        """Получает станции для конкретного города

        Args:
            city (str): Название города

        Returns:
            list: Список уникальных станций для этого города
        """
        railways_car_data = self.load_railways_car()
        stations = []
        seen = set()

        for item in railways_car_data:
            if item["city"].lower() == city.lower():
                station = item["station"]
                if station.lower() not in seen:
                    stations.append(station)
                    seen.add(station.lower())

        if not stations:
            print(f"⚠️ Станции для города '{city}' не найдены в railways-car")

        return sorted(stations)

    # ═══════════════════════════════════════════════════════════
    # МЕТОДЫ ПОИСКА (ИСПРАВЛЕННЫЕ)
    # ═══════════════════════════════════════════════════════════

    def find_freight(self, point_a, point_b, container):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Находит цену фрахта для маршрута

        Args:
            point_a (str): Пункт отправления (китайский порт)
            point_b (str): Пункт назначения (российский порт)
            container (str): Размер контейнера (20 или 40)

        Returns:
            float или None: Цена в USD или None если не найдено
        """
        freights = self.load_freights()
        container_normalized = self._normalize_container(container)

        for freight in freights:
            if (
                freight["point_a"].lower() == point_a.lower()
                and freight["point_b"].lower() == point_b.lower()
                and freight["container"] == container_normalized
            ):
                return freight["freight_usd"]

        # ✅ ИСПРАВЛЕНИЕ: логируем причину при ошибке
        print(f"⚠️ Маршрут не найден: {point_a} → {point_b} ({container_normalized})")
        return None

    def find_duty(self, customs_value_rub):
        """Находит таможенный сбор по стоимости

        Args:
            customs_value_rub (float): Таможенная стоимость в рублях

        Returns:
            int: Размер сбора в рублях (0 если не найден диапазон)
        """
        duties = self.load_duties()
        for duty in duties:
            if duty["min"] <= customs_value_rub <= duty["max"]:
                return duty["fee"]
        return 0

    def find_port_by_city(self, city):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Находит ПЕРВЫЙ порт по названию города

        ПРИМЕЧАНИЕ: В структуре один город обычно = один порт.
        Если нужны ВСЕ порты → используйте get_ports_by_city()

        Args:
            city (str): Название города

        Returns:
            str или None: Название первого найденного порта или None если не найдено
        """
        city_port_data = self.load_city_port()
        for item in city_port_data:
            if item["city"].lower() == city.lower():
                return item["port"]

        print(f"⚠️ Порт для города '{city}' не найден")
        return None

    def find_railways_price(self, port, station, container):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Находит цену доставки по ЖД до станции

        Args:
            port (str): Название порта
            station (str): Название станции
            container (str): Размер контейнера (20 или 40)

        Returns:
            float или None: Цена в рублях или None если не найдено
        """
        railways = self.load_railways()
        container_normalized = self._normalize_container(container)

        for rail in railways:
            if (
                rail["port"].lower() == port.lower()
                and rail["station"].lower() == station.lower()
                and rail["container"] == container_normalized
            ):
                return rail["price"]

        print(f"⚠️ ЖД маршрут не найден: {port} → {station} ({container_normalized})")
        return None

    def find_railways_car_price(self, station, city, container):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Находит цену доставки от ЖД станции до города

        Порядок параметров изменён на более интуитивный: station, city, container

        Args:
            station (str): Название станции
            city (str): Название города назначения
            container (str): Размер контейнера (20 или 40)

        Returns:
            float или None: Цена в рублях или None если не найдено
        """
        railways_car = self.load_railways_car()
        container_normalized = self._normalize_container(container)

        for item in railways_car:
            if (
                item["station"].lower() == station.lower()
                and item["container"] == container_normalized
                and item["city"].lower() == city.lower()
            ):
                return item["price"]

        print(f"⚠️ Маршрут ст-г не найден: {station} → {city} ({container_normalized})")
        return None

    def find_car_price(self, port, city, container):
        """✅ ИСПРАВЛЕННЫЙ МЕТОД v2.6: Находит цену доставки авто из порта в город

        Args:
            port (str): Название порта
            city (str): Название города
            container (str): Размер контейнера (20 или 40)

        Returns:
            float или None: Цена в рублях или None если не найдено
        """
        car_data = self.load_car()
        container_normalized = self._normalize_container(container)

        for item in car_data:
            if (
                item["port"].lower() == port.lower()
                and item["city"].lower() == city.lower()
                and item["container"] == container_normalized
            ):
                return item["price"]

        print(f"⚠️ Авто маршрут не найден: {port} → {city} ({container_normalized})")
        return None

    def get_railways_stations_by_port(self, port):
        """Получает все станции для конкретного порта

        Args:
            port (str): Название порта

        Returns:
            list: Список уникальных названий станций
        """
        railways = self.load_railways()
        stations = []
        seen = set()

        for rail in railways:
            if rail["port"].lower() == port.lower():
                station = rail["station"]
                if station.lower() not in seen:
                    stations.append(station)
                    seen.add(station.lower())

        return sorted(stations)

    def get_available_cities(self):
        """Получает список всех доступных городов для назначения

        Returns:
            list: Список уникальных названий городов
        """
        city_port_data = self.load_city_port()
        cities = []
        seen = set()

        for item in city_port_data:
            city = item["city"]
            if city.lower() not in seen:
                cities.append(city)
                seen.add(city.lower())

        return sorted(cities)


# Создаём синглтон для использования по всему проекту
sheets_client = GoogleSheetsClient()
