from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class CalculatorRequest(BaseModel):
    """Модель запроса для расчёта себестоимости"""

    calculator_type: Literal[1, 2, 3] = Field(
        ...,
        description="Тип калькулятора: 1, 2 или 3"
    )

    material: str = Field(
        ...,
        min_length=1,
        description="Материал"
    )

    port_from: str = Field(
        ...,
        min_length=1,
        description="Порт отправления"
    )

    city_to: str = Field(
        ...,
        min_length=1,
        description="Пункт назначения"
    )

    railway_station: Optional[str] = Field(
        None,
        description="ЖД станция (условное поле, требуется для Владивостока)"
    )

    quantity: int = Field(
        ...,
        gt=0,
        description="Количество (кг/шт)"
    )

    container_size: Literal["20ft", "40ft", "40ftHC"] = Field(
        ...,
        description="Размер контейнера"
    )

    price_per_kg: float = Field(
        ...,
        gt=0,
        description="Цена за кг"
    )

    @field_validator("material", "port_from", "city_to")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        """Удаляет пробелы по краям строковых полей"""
        if v is None:
            return v
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "example": {
                "calculator_type": 1,
                "material": "Пластик",
                "port_from": "Шанхай",
                "city_to": "Москва",
                "railway_station": "Восточный",
                "quantity": 1000,
                "container_size": "40ft",
                "price_per_kg": 5.50
            }
        }
    }
