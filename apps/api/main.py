import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# Загружаем .env до инициализации репозиториев, чтобы GOOGLE_SHEET_ID
# и другие переменные были доступны на этапе импорта.
BASE_DIR = Path(__file__).resolve().parent
ROOT_ENV_FILE = BASE_DIR.parent.parent / ".env"
if ROOT_ENV_FILE.exists():
    load_dotenv(ROOT_ENV_FILE)
else:
    load_dotenv()

from models.CalculatorRequest import CalculatorRequest
from models.CalculatorResponse import CalculatorResponse
from models.Calculator2Request import Calculator2Request
from models.Calculator2Response import Calculator2Response
from calculators import CALCULATORS
from repositories.sheets_repo import sheets_repo
from repositories.currency_repo import currency_repo
from repositories.data_repo import reference_data_repo
from calculators.calculator2 import (
    Calculator2ConfigError,
    Calculator2ValidationError,
    build_calculator2_config_payload,
    calculate_calc2,
)

app = FastAPI(
    title="Calculator API",
    description="API для калькуляторов себестоимости",
    version="1.0.0"
)

logger = logging.getLogger(__name__)


def _safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _find_rate(params: dict, aliases: tuple[str, ...]):
    for alias in aliases:
        value = _safe_float(params.get(alias))
        if value is not None and value > 0:
            return value
    return None


def _normalize_calculator2_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(payload) if isinstance(payload, dict) else {}
    values = normalized.get("values")

    if isinstance(values, dict):
        normalized["values"] = dict(values)
        return normalized

    normalized["values"] = {
        key: value for key, value in normalized.items() if key != "currency_rate_date"
    }
    return normalized


def _extract_latest_cny_rate(currency_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rates = currency_payload.get("rates")
    if not isinstance(rates, list):
        return None

    for item in rates:
        if not isinstance(item, dict) or item.get("code") != "CNY":
            continue

        current_rate = _safe_float(item.get("current_rate"))
        if current_rate is None or current_rate <= 0:
            continue

        rate_date = None
        history = item.get("history")
        if isinstance(history, list) and history:
            latest_point = history[-1]
            if isinstance(latest_point, dict):
                raw_date = latest_point.get("date")
                if isinstance(raw_date, str) and raw_date.strip():
                    rate_date = raw_date.strip()

        return {
            "rate": current_rate,
            "date": rate_date,
        }

    return None


def _get_calculator2_payload() -> Dict[str, Any]:
    payload = _normalize_calculator2_payload(reference_data_repo.get_calculator2_parameters())

    try:
        currency_payload = currency_repo.get_weekly_rates(days=7)
        latest_cny = _extract_latest_cny_rate(currency_payload)
    except Exception:
        logger.warning("CBR request failed for Calculator 2 config, using reference data rate")
        latest_cny = None

    if latest_cny is None:
        return payload

    values = payload.setdefault("values", {})
    values["course_cny_to_rub"] = latest_cny["rate"]
    values.pop("exchange_rate_cny_to_rub_adjusted", None)
    values.pop("course_cny_to_rub_adjusted", None)

    if latest_cny.get("date"):
        payload["currency_rate_date"] = latest_cny["date"]

    return payload


def _build_fallback_currency_payload(params: dict, days: int):
    usd = _find_rate(params, ("course_usd_to_rub", "usd_to_rub", "usd"))
    eur = _find_rate(params, ("course_eur_to_rub", "eur_to_rub", "eur"))
    cny = _find_rate(params, ("course_cny_to_rub", "cny_to_rub", "yuan_to_rub", "cny", "yuan"))

    mapping = (
        ("USD", "US Dollar", usd),
        ("EUR", "Euro", eur),
        ("CNY", "Chinese Yuan", cny),
    )

    rates = []
    today = datetime.now(timezone.utc).date().isoformat()

    for code, name, rate in mapping:
        if rate is None:
            continue
        rates.append(
            {
                "code": code,
                "name": name,
                "current_rate": round(rate, 4),
                "weekly_change": 0.0,
                "weekly_change_percent": 0.0,
                "history": [{"date": today, "rate": round(rate, 4)}],
            }
        )

    if not rates:
        return None

    return {
        "base": "RUB",
        "window_days": days,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "sheets_parameters_fallback",
        "rates": rates,
    }


def _error_payload(message: str, code: str, field: Optional[str] = None):
    payload = {
        "success": False,
        "error": {
            "message": message,
            "code": code,
        },
    }

    if field:
        payload["error"]["details"] = [{"field": field, "message": message}]

    return payload

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Calculator API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Custom validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации с понятным форматом"""
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"][1:])  # пропускаем "body"
        message = error["msg"]
        errors.append({
            "field": field,
            "message": message
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "message": "Ошибка валидации данных",
                "code": "VALIDATION_ERROR",
                "details": errors
            }
        }
    )


@app.post("/calculate", response_model=CalculatorResponse, status_code=status.HTTP_200_OK)
async def calculate(request: CalculatorRequest) -> CalculatorResponse:
    """
    Эндпоинт для расчёта себестоимости

    - **calculator_type**: Тип калькулятора (1, 2 или 3)
    - **material**: Материал
    - **port_from**: Порт отправления
    - **city_to**: Пункт назначения
    - **railway_station**: ЖД станция (опционально)
    - **quantity**: Количество
    - **container_size**: Размер контейнера (20ft, 40ft)
    - **price_per_kg**: Цена за кг
    """
    calculator = CALCULATORS.get(request.calculator_type)

    if calculator is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "message": f"Неверный тип калькулятора: {request.calculator_type}",
                    "code": "INVALID_CALCULATOR_TYPE"
                }
            }
        )

    return calculator(request)


@app.post("/calculate/calc-2", response_model=Calculator2Response, status_code=status.HTTP_200_OK)
async def calculate_calc_2(request: Calculator2Request) -> Calculator2Response:
    try:
        payload = _get_calculator2_payload()
        return calculate_calc2(request, payload)
    except Calculator2ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_error_payload(error.message, error.code, error.field),
        ) from error
    except Calculator2ConfigError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_error_payload(error.message, error.code),
        ) from error


# === Эндпоинты для справочных данных ===

@app.get("/data/materials")
async def get_materials():
    """Получить список материалов"""
    materials = sheets_repo.get_materials()
    return {"data": materials}


@app.get("/data/parameters")
async def get_parameters():
    """Получить параметры (курсы валют)"""
    parameters = sheets_repo.get_parameters()
    return {"data": parameters}


@app.get("/data/calculator2-config")
async def get_calculator2_config():
    try:
        payload = _get_calculator2_payload()
        return {"data": build_calculator2_config_payload(payload)}
    except Calculator2ConfigError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_error_payload(error.message, error.code),
        ) from error


@app.get("/data/currency-rates")
async def get_currency_rates(days: int = 7):
    """Получить курсы USD/EUR/CNY к RUB и динамику за период"""
    if days < 2 or days > 14:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "message": "Параметр days должен быть в диапазоне 2..14",
                    "code": "INVALID_DAYS_RANGE",
                },
            },
        )

    try:
        rates = currency_repo.get_weekly_rates(days=days)
        return {"data": rates}
    except Exception:
        try:
            params = sheets_repo.get_parameters()
            fallback_payload = _build_fallback_currency_payload(params, days)
            if fallback_payload is not None:
                return {"data": fallback_payload}
        except Exception:
            pass

        empty_payload = {
            "base": "RUB",
            "window_days": days,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "unavailable",
            "rates": [],
        }
        return {"data": empty_payload}


@app.get("/data/freight")
async def get_freight():
    """Получить данные по фрахту"""
    freight = sheets_repo.get_freight()
    return {"data": freight}


@app.get("/data/customs-fees")
async def get_customs_fees():
    """Получить таможенные сборы по диапазонам"""
    fees = sheets_repo.get_customs_fees()
    return {"data": fees}


@app.get("/data/city-port-map")
async def get_city_port_map():
    """Получить маппинг город → порт"""
    city_port = sheets_repo.get_city_port_map()
    return {"data": city_port}


@app.get("/data/china-port-cities")
async def get_china_port_cities(port: str):
    """Получить список городов Китая для выбранного китайского порта."""
    normalized_port = port.strip()
    if not normalized_port:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "message": "Параметр port не должен быть пустым",
                    "code": "EMPTY_PORT",
                },
            },
        )

    result = sheets_repo.get_china_port_cities_by_port(normalized_port)
    return {"data": result}


@app.get("/data/car-delivery")
async def get_car_delivery():
    """Получить данные по доставке авто"""
    delivery = sheets_repo.get_car_delivery()
    return {"data": delivery}


@app.get("/data/railway-delivery")
async def get_railway_delivery():
    """Получить данные по доставке ЖД от порта"""
    delivery = sheets_repo.get_railway_delivery()
    return {"data": delivery}


@app.get("/data/railway-car-delivery")
async def get_railway_car_delivery():
    """Получить данные по доставке ЖД+авто от станции"""
    delivery = sheets_repo.get_railway_car_delivery()
    return {"data": delivery}


@app.get("/data/all")
async def get_all_data():
    """Получить все справочные данные"""
    data = sheets_repo.get_all_data()
    return {"data": data}


@app.post("/cache/invalidate")
async def invalidate_cache(sheet_name: str = None):
    """Очистить кэш для листа или всех листов"""
    sheets_repo.invalidate_cache(sheet_name)
    if sheet_name:
        return {"message": f"Кэш для листа '{sheet_name}' очищен"}
    return {"message": "Кэш всех листов очищен"}
