from pydantic import BaseModel, Field, field_validator


class Calculator2Request(BaseModel):
    """Модель запроса для Calculator 2."""

    purchase_price_cny_per_kg: float = Field(
        ...,
        gt=0,
        description="Закупка материала в КНР, CNY/кг",
    )

    weight_kg: float = Field(
        ...,
        gt=0,
        description="Вес партии, кг",
    )

    exchange_rate_cny_to_rub_adjusted: float = Field(
        ...,
        gt=0,
        description="Курс CNY→RUB для расчёта",
    )

    @field_validator(
        "purchase_price_cny_per_kg",
        "weight_kg",
        "exchange_rate_cny_to_rub_adjusted",
        mode="before",
    )
    @classmethod
    def normalize_numeric_input(cls, value):
        if isinstance(value, str):
            normalized = value.strip().replace(",", ".")
            return normalized or None
        return value

    model_config = {
        "json_schema_extra": {
            "example": {
                "purchase_price_cny_per_kg": 33,
                "weight_kg": 100,
                "exchange_rate_cny_to_rub_adjusted": 14.55,
            }
        }
    }
