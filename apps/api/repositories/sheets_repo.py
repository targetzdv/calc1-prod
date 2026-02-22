"""
Google Sheets repository с кэшированием через Redis
"""
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import redis

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


class SheetsRepository:
    """Репозиторий для работы с Google Sheets API с кэшированием"""

    def __init__(self):
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = None
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
        except Exception as error:
            logger.warning("Redis disabled: failed to init client (%s)", error)
        self.service = None

        # TTL кэша в секундах (1 час)
        self.cache_ttl = 3600

    def _resolve_credentials_path(self) -> str:
        """Resolve credentials path for both docker and local runs."""
        env_path = os.getenv("GOOGLE_CREDENTIALS_PATH")
        if env_path:
            return env_path

        candidate_paths = [
            Path("/app/credentials.json"),
            Path(__file__).resolve().parent.parent / "credentials.json",
        ]
        for path in candidate_paths:
            if path.exists():
                return str(path)

        # Keep deterministic fallback for explicit error message.
        return str(candidate_paths[0])

    def _get_service(self):
        """Получить Google Sheets service (lazy init)"""
        if self.service is None:
            if not self.sheet_id:
                raise RuntimeError("GOOGLE_SHEET_ID is not set")

            credentials_path = self._resolve_credentials_path()
            credentials = Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            self.service = build('sheets', 'v4', credentials=credentials)
        return self.service

    def _cache_get(self, key: str) -> Optional[str]:
        if self.redis_client is None:
            return None
        try:
            return self.redis_client.get(key)
        except Exception as error:
            logger.warning("Redis read failed for key '%s': %s", key, error)
            self.redis_client = None
            return None

    def _cache_setex(self, key: str, ttl: int, value: str):
        if self.redis_client is None:
            return
        try:
            self.redis_client.setex(key, ttl, value)
        except Exception as error:
            logger.warning("Redis write failed for key '%s': %s", key, error)
            self.redis_client = None

    def _cache_delete(self, *keys: str):
        if self.redis_client is None or not keys:
            return
        try:
            self.redis_client.delete(*keys)
        except Exception as error:
            logger.warning("Redis delete failed for keys %s: %s", keys, error)
            self.redis_client = None

    def _cache_keys(self, pattern: str) -> List[str]:
        if self.redis_client is None:
            return []
        try:
            return self.redis_client.keys(pattern)
        except Exception as error:
            logger.warning("Redis keys failed for pattern '%s': %s", pattern, error)
            self.redis_client = None
            return []

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

    def _get_data_with_cache(self, sheet_name: str, range_name: str = None) -> List[List[str]]:
        """Получить данные из Sheets с кэшированием"""
        cache_key = self._get_cache_key(sheet_name)

        # Проверяем кэш
        cached = self._cache_get(cache_key)
        if cached:
            return json.loads(cached)

        # Загружаем из Google Sheets
        if range_name is None:
            range_name = f'{sheet_name}!A1:Z1000'

        service = self._get_service()
        result = service.spreadsheets().values().get(
            spreadsheetId=self.sheet_id,
            range=range_name
        ).execute()

        values = result.get('values', [])

        # Сохраняем в кэш
        if values:
            self._cache_setex(cache_key, self.cache_ttl, json.dumps(values))

        return values

    def invalidate_cache(self, sheet_name: Optional[str] = None):
        """Очистить кэш для листа или всех листов"""
        if sheet_name:
            cache_key = self._get_cache_key(sheet_name)
            self._cache_delete(cache_key)
        else:
            # Очистить все ключи sheets:*
            keys = self._cache_keys('sheets:*')
            if keys:
                self._cache_delete(*keys)

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

    def get_china_port_cities(self) -> List[Dict[str, str]]:
        """Получить регионы и ближайшие города по китайскому порту.

        Ожидаемая структура листа `china_port_final`:
        - china_port_reg
        - china_port1
        - Region
        - city_china
        """
        values = self._get_data_with_cache('china_port_final')

        if not values:
            return []

        header = [str(cell).strip().lower() for cell in values[0]]
        data = values[1:]
        port_cities: List[Dict[str, str]] = []

        idx_port_reg = header.index('china_port_reg') if 'china_port_reg' in header else 0
        idx_port1 = header.index('china_port1') if 'china_port1' in header else 1
        idx_region = header.index('region') if 'region' in header else 2
        idx_city = header.index('city_china') if 'city_china' in header else 3

        for row in data:
            def get_col(index: int) -> str:
                return str(row[index]).strip() if len(row) > index else ""

            china_port_reg = get_col(idx_port_reg)
            china_port1 = get_col(idx_port1)
            region = get_col(idx_region)
            city_china = get_col(idx_city)

            if china_port_reg and china_port1 and region and city_china:
                port_cities.append({
                    'china_port_reg': china_port_reg,
                    'china_port1': china_port1,
                    'region': region,
                    'city_china': city_china,
                })

        return port_cities

    def get_all_data(self) -> Dict[str, Any]:
        """Получить все справочные данные"""
        return {
            'materials': self.get_materials(),
            'parameters': self.get_parameters(),
            'freight': self.get_freight(),
            'customs_fees': self.get_customs_fees(),
            'city_port_map': self.get_city_port_map(),
            'car_delivery': self.get_car_delivery(),
            'railway_delivery': self.get_railway_delivery(),
            'railway_car_delivery': self.get_railway_car_delivery(),
            'china_port_cities': self.get_china_port_cities(),
        }


# Глобальный экземпляр репозитория
sheets_repo = SheetsRepository()
