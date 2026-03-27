from typing import Literal, Optional

from pydantic import BaseModel, Field


class Calculator2InputPayload(BaseModel):
    purchase_price_cny_per_kg: float
    weight_kg: float
    exchange_rate_cny_to_rub_adjusted: float
    currency_rate_date: Optional[str] = None


class Calculator2IntermediatePayload(BaseModel):
    material_cost_cny: float
    intl_delivery_cny: float
    packing_cny: float
    mo_delivery_cny: float
    total_cny: float
    cost_rub_before_supplier_vat_normalization: float
    cost_rub_without_supplier_vat: float
    total_cost_rub_22_vat: float
    cost_per_kg_rub_22_vat: float


class Calculator2ConstantsPayload(BaseModel):
    course_cny_to_rub: Optional[float] = None
    intl_delivery_usd_per_kg: float
    usd_to_cny_rate: float
    supplier_coefficient: float
    supplier_vat_divisor: float
    supplier_vat_percent: float
    our_vat_multiplier: float
    our_vat_percent: float
    packing_cny_per_kg: float
    packing_min_cny: float
    mo_delivery_cny: float
    max_weight_kg: float
    rate_markup_percent: float


class Calculator2ResultPayload(BaseModel):
    total_cost_rub: float
    cost_per_kg_rub: float
    result_label: str = Field(
        ...,
        description="Итоговый label результата",
    )


class Calculator2RawData(BaseModel):
    calculator_type: Literal[2] = 2
    input: Calculator2InputPayload
    intermediate: Calculator2IntermediatePayload
    constants: Calculator2ConstantsPayload
    result: Calculator2ResultPayload


class Calculator2Response(BaseModel):
    result: str = Field(
        ...,
        description="Отформатированный текст результата расчёта",
    )
    raw_data: Calculator2RawData = Field(
        ...,
        description="Структурированные данные расчёта Calculator 2",
    )
