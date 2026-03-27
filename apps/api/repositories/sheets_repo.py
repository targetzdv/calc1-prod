"""
Google Sheets repository с кэшированием через Redis
"""
import os
import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from decimal import Decimal
import redis
import httplib2

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from google_auth_httplib2 import AuthorizedHttp


logger = logging.getLogger(__name__)


class SheetsRepository:
    """Репозиторий для работы с Google Sheets API с кэшированием"""

    def __init__(self):
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = self._create_redis_client()
        self.service = None
        self.request_retries = int(os.getenv("GOOGLE_REQUEST_RETRIES", "2"))
        self.http_timeout_seconds = int(os.getenv("GOOGLE_HTTP_TIMEOUT_SECONDS", "30"))
        self.local_data_path = Path(__file__).resolve().parent.parent / "data" / "reference_data.local.json"

        # TTL кэша в секундах (1 час)
        self.cache_ttl = 3600

    def _create_redis_client(self):
        try:
            client = redis.from_url(self.redis_url, decode_responses=True)
            client.ping()
            return client
        except Exception:
            return None

    def _get_service(self):
        """Получить Google Sheets service (lazy init)"""
        # Если .env загрузился после импорта модуля, подхватываем значение здесь.
        if not self.sheet_id:
            self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        if not self.sheet_id:
            raise RuntimeError("GOOGLE_SHEET_ID is not configured")

        if self.service is None:
            configured_path = os.getenv('GOOGLE_CREDENTIALS_PATH')
            local_default_path = Path(__file__).resolve().parent.parent / "credentials.json"
            docker_default_path = Path("/app/credentials.json")

            if configured_path:
                credentials_path = Path(configured_path)
            elif local_default_path.exists():
                credentials_path = local_default_path
            else:
                credentials_path = docker_default_path

            if not credentials_path.exists():
                raise RuntimeError(
                    "Google credentials file is not found. "
                    "Set GOOGLE_CREDENTIALS_PATH or place credentials.json in apps/api."
                )

            credentials = Credentials.from_service_account_file(
                str(credentials_path),
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            authed_http = AuthorizedHttp(
                credentials=credentials,
                http=httplib2.Http(timeout=self.http_timeout_seconds),
            )
            self.service = build('sheets', 'v4', http=authed_http, cache_discovery=False)
        return self.service

    def _get_cache_key(self, sheet_name: str) -> str:
        """Сгенерировать ключ кэша для листа"""
        return f"sheets:{sheet_name}"

    def _parse_number(self, value: str, is_percentage: bool = False) -> Optional[float]:
        """Парсинг чисел (заменяет запятую на точку, обрабатывает проценты)"""
        if value is None or value == '':
            return None
        try:
            # Заменяем неразрывный пробел и обычный пробел, а также запятую
            cleaned = value.replace('\xa0', '').replace(' ', '').replace(',', '.')

            # Определяем, это процент или нет
            if '%' in cleaned:
                cleaned = cleaned.replace('%', '')
                is_percentage = True

            result = float(cleaned)

            # Если это процент, конвертируем в десятичную дробь
            if is_percentage:
                result = result / 100.0

            return result
        except (ValueError, AttributeError):
            return None

    def _normalize_header(self, value: str) -> str:
        if not value:
            return ""
        return "".join(char for char in value.strip().lower() if char.isalnum())

    def _normalize_text(self, value: str) -> str:
        if not value:
            return ""
        return " ".join(value.strip().lower().split())

    def _parse_bool(self, value: Any) -> Optional[bool]:
        if value is None:
            return None

        normalized = str(value).strip().lower()
        if not normalized:
            return None

        if normalized in {"true", "1", "yes", "y", "да"}:
            return True

        if normalized in {"false", "0", "no", "n", "нет"}:
            return False

        return None

    def _split_bilingual_city(self, value: str) -> tuple[str, str]:
        """Пробуем извлечь EN/RU названия из одной строки."""
        raw = value.strip()
        if not raw:
            return "", ""

        for separator in (" / ", "/", " - ", " | ", " — "):
            if separator in raw:
                left, right = [part.strip() for part in raw.split(separator, 1)]
                if left and right:
                    return left, right

        if "(" in raw and raw.endswith(")"):
            left, _, right_part = raw.partition("(")
            left = left.strip()
            right = right_part[:-1].strip()
            if left and right:
                return left, right

        return raw, raw

    def _fill_forward(self, row: List[str]) -> List[str]:
        """Заполнить пустые заголовки значением слева (для merged ячеек)."""
        filled: List[str] = []
        current = ""
        for cell in row:
            value = cell.strip() if cell else ""
            if value:
                current = value
            filled.append(current)
        return filled

    def _get_data_with_cache(self, sheet_name: str, range_name: str = None) -> List[List[str]]:
        """Получить данные из Sheets с кэшированием"""
        cache_key = self._get_cache_key(sheet_name)

        # Проверяем кэш
        if self.redis_client is not None:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        # Загружаем из Google Sheets
        if range_name is None:
            range_name = f'{sheet_name}!A1:Z1000'

        result = None
        last_error: Optional[Exception] = None

        for attempt in range(self.request_retries + 1):
            try:
                service = self._get_service()
                result = service.spreadsheets().values().get(
                    spreadsheetId=self.sheet_id,
                    range=range_name
                ).execute(num_retries=self.request_retries)
                last_error = None
                break
            except Exception as error:
                last_error = error
                self.service = None
                if attempt < self.request_retries:
                    time.sleep(min(0.35 * (attempt + 1), 1.2))

        if result is None:
            assert last_error is not None
            raise last_error

        values = result.get('values', [])

        # Сохраняем в кэш
        if values and self.redis_client is not None:
            try:
                self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(values))
            except Exception:
                pass

        return values

    def invalidate_cache(self, sheet_name: Optional[str] = None):
        """Очистить кэш для листа или всех листов"""
        if self.redis_client is None:
            return

        if sheet_name:
            cache_key = self._get_cache_key(sheet_name)
            try:
                self.redis_client.delete(cache_key)
            except Exception:
                pass
        else:
            # Очистить все ключи sheets:*
            try:
                keys = self.redis_client.keys('sheets:*')
                if keys:
                    self.redis_client.delete(*keys)
            except Exception:
                pass

    def _load_local_reference_data(self) -> Dict[str, Any]:
        try:
            with self.local_data_path.open("r", encoding="utf-8") as source:
                payload = json.load(source)
        except Exception:
            logger.exception("Failed to load local reference fallback: %s", self.local_data_path)
            return {}

        if isinstance(payload, dict):
            return payload
        return {}

    # === Методы для получения справочников ===

    def get_materials(self) -> List[Dict[str, Any]]:
        """Получить список материалов"""
        values = self._get_data_with_cache('Materials')

        if not values:
            return []

        # Пропускаем заголовок
        data = values[1:]

        materials = []
        for row in data:
            if len(row) >= 4:
                duty = self._parse_number(row[2], is_percentage=True)
                materials.append({
                    'material': row[0],
                    'kod': row[1],
                    'duty': duty,
                    'calculation_type': row[3]
                })

        return materials

    def get_parameters(self) -> Dict[str, float]:
        """Получить параметры (курсы валют)"""
        values = self._get_data_with_cache('parameters')

        if not values:
            return {}

        params = {}
        for row in values[1:]:  # Пропускаем заголовок
            if len(row) >= 2:
                param_name = row[0].strip().lower()
                param_value = self._parse_number(row[1])
                if param_value is not None:
                    params[param_name] = param_value

        return params

    def get_calculator2_parameters(self) -> Dict[str, Any]:
        """Получить параметры Calculator 2."""
        try:
            values = self._get_data_with_cache('calculator2_parameters')

            if not values:
                return {}

            headers = [self._normalize_header(cell) for cell in values[0]]
            key_index = next((index for index, header in enumerate(headers) if header == "key"), None)
            value_index = next((index for index, header in enumerate(headers) if header == "value"), None)
            is_active_index = next((index for index, header in enumerate(headers) if header == "isactive"), None)
            updated_at_index = next((index for index, header in enumerate(headers) if header == "updatedat"), None)

            if key_index is None or value_index is None:
                return {}

            params: Dict[str, float] = {}
            updated_at_map: Dict[str, str] = {}

            for row in values[1:]:
                if len(row) <= max(key_index, value_index):
                    continue

                key = row[key_index].strip().lower()
                if not key:
                    continue

                if is_active_index is not None and len(row) > is_active_index:
                    is_active = self._parse_bool(row[is_active_index])
                    if is_active is False:
                        continue

                raw_value = row[value_index]
                parsed_value = self._parse_number(raw_value, is_percentage=False)
                if parsed_value is None:
                    continue

                params[key] = parsed_value

                if updated_at_index is not None and len(row) > updated_at_index:
                    updated_at = row[updated_at_index].strip()
                    if updated_at:
                        updated_at_map[key] = updated_at

            rate_date = (
                updated_at_map.get("course_cny_to_rub")
                or updated_at_map.get("exchange_rate_cny_to_rub_adjusted")
                or next(iter(updated_at_map.values()), None)
            )

            return {
                "values": params,
                "currency_rate_date": rate_date,
            }
        except Exception:
            logger.warning("Google Sheets request failed for calculator2_parameters, using local fallback")
            fallback = self._load_local_reference_data()
            calculator2_parameters = fallback.get("calculator2_parameters", {})
            if isinstance(calculator2_parameters, dict):
                return calculator2_parameters
            return {}

    def get_freight(self) -> List[Dict[str, Any]]:
        """Получить данные по фрахту"""
        values = self._get_data_with_cache('fraht')

        if not values:
            return []

        data = values[1:]
        freight = []

        for row in data:
            if len(row) >= 4:
                freight_usd = self._parse_number(row[3])
                freight.append({
                    'point_a': row[0],
                    'point_b': row[1],
                    'container': row[2],
                    'freight_usd': freight_usd
                })

        return freight

    def get_customs_fees(self) -> List[Dict[str, Any]]:
        """Получить таможенные сборы по диапазонам"""
        values = self._get_data_with_cache('tamozh_sbor')

        if not values:
            return []

        data = values[1:]
        fees = []

        for row in data:
            if len(row) >= 3:
                # Для таможенных сборов используем строгий парсинг (без процентов)
                min_val = self._parse_number(row[0], is_percentage=False)
                max_val = self._parse_number(row[1], is_percentage=False)
                fee = self._parse_number(row[2], is_percentage=False)

                # max_val может быть None для диапазона "от X и выше"
                if min_val is not None and fee is not None:
                    # Если max пустой, используем большое конечное число:
                    # JSON не сериализует float('inf') в стандартном режиме.
                    if max_val is None:
                        max_val = 10**18
                    fees.append({
                        'min': min_val,
                        'max': max_val,
                        'fee': fee
                    })

        return fees

    def get_city_port_map(self) -> Dict[str, str]:
        """Получить маппинг город → порт"""
        values = self._get_data_with_cache('city-port')

        if not values:
            return {}

        city_port = {}
        for row in values[1:]:  # Пропускаем заголовок
            if len(row) >= 2:
                city_port[row[0]] = row[1]

        return city_port

    def get_china_port_cities_by_port(self, port_name: str) -> Dict[str, Any]:
        """Найти города Китая по выбранному китайскому порту.

        Структура листа `china_port_final`:
        - china_port_reg
        - china_port1
        - Region
        - city_china
        """
        values = self._get_data_with_cache('china_port_final')

        normalized_port_name = self._normalize_text(port_name)
        if not values or not normalized_port_name:
            return {
                'requested_port': port_name,
                'matched_ports': [],
                'cities': [],
                'total_cities': 0,
            }

        headers = [self._normalize_header(cell) for cell in values[0]]

        port_reg_index = next((index for index, header in enumerate(headers) if header == "chinaportreg"), None)
        port_display_index = next((index for index, header in enumerate(headers) if header == "chinaport1"), None)
        region_index = next((index for index, header in enumerate(headers) if header == "region"), None)
        city_index = next((index for index, header in enumerate(headers) if header == "citychina"), None)

        if (
            port_reg_index is None
            or port_display_index is None
            or region_index is None
            or city_index is None
        ):
            return {
                'requested_port': port_name,
                'matched_ports': [],
                'cities': [],
                'total_cities': 0,
            }

        seen_pairs = set()
        matched_ports = set()
        cities = []

        for row in values[1:]:
            if len(row) <= max(port_reg_index, port_display_index, region_index, city_index):
                continue

            port_reg = row[port_reg_index].strip()
            port_display = row[port_display_index].strip()
            district = row[region_index].strip()
            city_raw = row[city_index].strip()

            if not port_reg or not port_display or not district or not city_raw:
                continue

            if self._normalize_text(port_reg) != normalized_port_name:
                continue

            city_en, city_ru = self._split_bilingual_city(city_raw)
            if not city_en or not city_ru:
                continue

            pair_key = (city_en, city_ru, district)
            if pair_key in seen_pairs:
                continue

            seen_pairs.add(pair_key)
            matched_ports.add(port_display)
            cities.append(
                {
                    'city_en': city_en,
                    'city_ru': city_ru,
                    'district': district,
                }
            )

        return {
            'requested_port': port_name,
            'matched_ports': sorted(matched_ports),
            'cities': cities,
            'total_cities': len(cities),
        }

    def get_car_delivery(self) -> List[Dict[str, Any]]:
        """Получить данные по доставке авто"""
        values = self._get_data_with_cache('car')

        if not values:
            return []

        data = values[1:]
        delivery = []

        for row in data:
            if len(row) >= 4:
                price = self._parse_number(row[3])
                delivery.append({
                    'port': row[0],
                    'city': row[1],
                    'container': row[2],
                    'price': price
                })

        return delivery

    def get_railway_delivery(self) -> List[Dict[str, Any]]:
        """Получить данные по доставке ЖД от порта"""
        values = self._get_data_with_cache('railways')

        if not values:
            return []

        data = values[1:]
        delivery = []

        for row in data:
            if len(row) >= 4:
                price = self._parse_number(row[3])
                delivery.append({
                    'port': row[0],
                    'station': row[1],
                    'container': row[2],
                    'price': price
                })

        return delivery

    def get_railway_car_delivery(self) -> List[Dict[str, Any]]:
        """Получить данные по доставке ЖД+авто от станции"""
        values = self._get_data_with_cache('railways-car')

        if not values:
            return []

        data = values[1:]
        delivery = []

        for row in data:
            if len(row) >= 4:
                price = self._parse_number(row[3])
                delivery.append({
                    'station': row[0],
                    'city': row[1],
                    'container': row[2],
                    'price': price
                })

        return delivery

    def get_all_data(self) -> Dict[str, Any]:
        """Получить все справочные данные"""
        try:
            return {
                'materials': self.get_materials(),
                'parameters': self.get_parameters(),
                'freight': self.get_freight(),
                'customs_fees': self.get_customs_fees(),
                'city_port_map': self.get_city_port_map(),
                'car_delivery': self.get_car_delivery(),
                'railway_delivery': self.get_railway_delivery(),
                'railway_car_delivery': self.get_railway_car_delivery(),
            }
        except Exception:
            logger.exception("Google Sheets request failed, using local fallback data")
            fallback = self._load_local_reference_data()
            return {
                'materials': fallback.get('materials', []),
                'parameters': fallback.get('parameters', {}),
                'freight': fallback.get('freight', []),
                'customs_fees': fallback.get('customs_fees', []),
                'city_port_map': fallback.get('city_port_map', {}),
                'car_delivery': fallback.get('car_delivery', []),
                'railway_delivery': fallback.get('railway_delivery', []),
                'railway_car_delivery': fallback.get('railway_car_delivery', []),
            }


# Глобальный экземпляр репозитория
sheets_repo = SheetsRepository()
