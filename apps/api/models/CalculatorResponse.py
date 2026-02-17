from pydantic import BaseModel, Field


class CalculatorResponse(BaseModel):
    """Модель ответа с результатом расчёта"""

    result: str = Field(
        ...,
        description="Отформатированный текст результата расчёта"
    )

    raw_data: dict = Field(
        ...,
        description="Сырые данные для отладки"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "result": "=== Результат расчёта ===\nМатериал: Пластик\n...\nСебестоимость: 10 000 ₽",
                "raw_data": {
                    "calculator_type": 1,
                    "total_cost": 10000.0,
                    "cost_per_kg": 10.0
                }
            }
        }
    }
