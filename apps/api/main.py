from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from models.CalculatorRequest import CalculatorRequest
from models.CalculatorResponse import CalculatorResponse
from calculators import CALCULATORS
from repositories.sheets_repo import sheets_repo

app = FastAPI(
    title="Calculator API",
    description="API для калькуляторов себестоимости",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
