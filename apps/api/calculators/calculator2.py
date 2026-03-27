from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

from models.Calculator2Request import Calculator2Request
from models.Calculator2Response import (
    Calculator2ConstantsPayload,
    Calculator2InputPayload,
    Calculator2IntermediatePayload,
    Calculator2RawData,
    Calculator2Response,
    Calculator2ResultPayload,
)
from models.CalculatorRequest import CalculatorRequest
from models.CalculatorResponse import CalculatorResponse


RESULT_LABEL = "Себестоимость на нашем складе в РФ, НДС 22%"
TWOPLACES = Decimal("0.01")
FOURPLACES = Decimal("0.0001")


class Calculator2ValidationError(Exception):
    def __init__(self, message: str, field: str, code: str = "CALCULATOR2_VALIDATION_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.field = field
        self.code = code


class Calculator2ConfigError(Exception):
    def __init__(self, message: str, code: str = "CALCULATOR2_CONFIG_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class Calculator2Config:
    course_cny_to_rub: Optional[Decimal]
    exchange_rate_cny_to_rub_adjusted: Optional[Decimal]
    currency_rate_date: Optional[str]
    intl_delivery_usd_per_kg: Decimal
    usd_to_cny_rate: Decimal
    supplier_coefficient: Decimal
    supplier_vat_divisor: Decimal
    our_vat_multiplier: Decimal
    packing_cny_per_kg: Decimal
    packing_min_cny: Decimal
    mo_delivery_cny: Decimal
    max_weight_kg: Decimal
    rate_markup_percent: Decimal

    @property
    def supplier_vat_percent(self) -> Decimal:
        return (self.supplier_vat_divisor - Decimal("1")) * Decimal("100")

    @property
    def our_vat_percent(self) -> Decimal:
        return (self.our_vat_multiplier - Decimal("1")) * Decimal("100")


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None

    if isinstance(value, Decimal):
        return value

    if isinstance(value, str):
        normalized = value.strip().replace(",", ".")
        if not normalized:
            return None
        return Decimal(normalized)

    return Decimal(str(value))


def _round_money(value: Decimal) -> float:
    return float(value.quantize(TWOPLACES, rounding=ROUND_HALF_UP))


def _round_rate(value: Decimal) -> float:
    return float(value.quantize(FOURPLACES, rounding=ROUND_HALF_UP))


def _format_money(value: float, currency: str) -> str:
    return f"{value:,.2f} {currency}"


def _format_weight(value: float) -> str:
    return f"{value:,.2f} кг"


def _format_date(value: Optional[str]) -> str:
    if not value:
        return "-"

    try:
        return datetime.fromisoformat(value).strftime("%d.%m.%Y")
    except ValueError:
        pass

    try:
        return datetime.strptime(value, "%d.%m.%Y").strftime("%d.%m.%Y")
    except ValueError:
        return value


def _get_nested_values(payload: Dict[str, Any]) -> Dict[str, Any]:
    values = payload.get("values")
    if isinstance(values, dict):
        return values
    return payload


def _require_positive(values: Dict[str, Any], key: str) -> Decimal:
    value = _to_decimal(values.get(key))
    if value is None or value <= 0:
        raise Calculator2ConfigError(f"Отсутствует или некорректен параметр Calculator 2: {key}")
    return value


def resolve_calculator2_config(payload: Dict[str, Any]) -> Calculator2Config:
    values = _get_nested_values(payload)

    course_cny_to_rub = _to_decimal(values.get("course_cny_to_rub"))
    adjusted_rate = _to_decimal(values.get("exchange_rate_cny_to_rub_adjusted")) or _to_decimal(
        values.get("course_cny_to_rub_adjusted")
    )
    rate_markup_percent = _require_positive(values, "rate_markup_percent")

    if adjusted_rate is None and course_cny_to_rub is not None and course_cny_to_rub > 0:
        adjusted_rate = course_cny_to_rub * (Decimal("1") + (rate_markup_percent / Decimal("100")))

    currency_rate_date = payload.get("currency_rate_date")
    if currency_rate_date is not None:
        currency_rate_date = str(currency_rate_date)

    return Calculator2Config(
        course_cny_to_rub=course_cny_to_rub if course_cny_to_rub and course_cny_to_rub > 0 else None,
        exchange_rate_cny_to_rub_adjusted=adjusted_rate if adjusted_rate and adjusted_rate > 0 else None,
        currency_rate_date=currency_rate_date,
        intl_delivery_usd_per_kg=_require_positive(values, "intl_delivery_usd_per_kg"),
        usd_to_cny_rate=_require_positive(values, "usd_to_cny_rate"),
        supplier_coefficient=_require_positive(values, "supplier_coefficient"),
        supplier_vat_divisor=_require_positive(values, "supplier_vat_divisor"),
        our_vat_multiplier=_require_positive(values, "our_vat_multiplier"),
        packing_cny_per_kg=_require_positive(values, "packing_cny_per_kg"),
        packing_min_cny=_require_positive(values, "packing_min_cny"),
        mo_delivery_cny=_require_positive(values, "mo_delivery_cny"),
        max_weight_kg=_require_positive(values, "max_weight_kg"),
        rate_markup_percent=rate_markup_percent,
    )


def build_calculator2_config_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    config = resolve_calculator2_config(payload)
    return {
        "course_cny_to_rub": _round_rate(config.course_cny_to_rub) if config.course_cny_to_rub is not None else None,
        "exchange_rate_cny_to_rub_adjusted": (
            _round_rate(config.exchange_rate_cny_to_rub_adjusted)
            if config.exchange_rate_cny_to_rub_adjusted is not None
            else None
        ),
        "currency_rate_date": config.currency_rate_date,
        "constants": {
            "intl_delivery_usd_per_kg": _round_rate(config.intl_delivery_usd_per_kg),
            "usd_to_cny_rate": _round_rate(config.usd_to_cny_rate),
            "supplier_coefficient": _round_rate(config.supplier_coefficient),
            "supplier_vat_divisor": _round_rate(config.supplier_vat_divisor),
            "supplier_vat_percent": _round_money(config.supplier_vat_percent),
            "our_vat_multiplier": _round_rate(config.our_vat_multiplier),
            "our_vat_percent": _round_money(config.our_vat_percent),
            "packing_cny_per_kg": _round_money(config.packing_cny_per_kg),
            "packing_min_cny": _round_money(config.packing_min_cny),
            "mo_delivery_cny": _round_money(config.mo_delivery_cny),
            "max_weight_kg": _round_money(config.max_weight_kg),
            "rate_markup_percent": _round_money(config.rate_markup_percent),
        },
    }


def calculate_calc2(request: Calculator2Request, payload: Dict[str, Any]) -> Calculator2Response:
    config = resolve_calculator2_config(payload)
    weight = _to_decimal(request.weight_kg)
    purchase_price = _to_decimal(request.purchase_price_cny_per_kg)
    rate = _to_decimal(request.exchange_rate_cny_to_rub_adjusted)

    if weight is None or weight <= 0:
        raise Calculator2ValidationError("Вес должен быть больше 0", "weight_kg")

    if weight > config.max_weight_kg:
        raise Calculator2ValidationError(
            "Для Calculator 2 допустим вес до 100 кг включительно",
            "weight_kg",
        )

    if purchase_price is None or purchase_price <= 0:
        raise Calculator2ValidationError("Закупка должна быть больше 0", "purchase_price_cny_per_kg")

    if rate is None or rate <= 0:
        raise Calculator2ValidationError(
            "Курс CNY→RUB должен быть больше 0",
            "exchange_rate_cny_to_rub_adjusted",
        )

    material_cost_cny = purchase_price * weight
    intl_delivery_cny = weight * config.intl_delivery_usd_per_kg * config.usd_to_cny_rate
    packing_cny = max(weight * config.packing_cny_per_kg, config.packing_min_cny)
    total_cny = material_cost_cny + intl_delivery_cny + packing_cny + config.mo_delivery_cny
    cost_rub_before_supplier_vat_normalization = total_cny * rate * config.supplier_coefficient
    cost_rub_without_supplier_vat = (
        cost_rub_before_supplier_vat_normalization / config.supplier_vat_divisor
    )
    total_cost_rub_22_vat = cost_rub_without_supplier_vat * config.our_vat_multiplier
    cost_per_kg_rub_22_vat = total_cost_rub_22_vat / weight

    raw_data = Calculator2RawData(
        input=Calculator2InputPayload(
            purchase_price_cny_per_kg=_round_money(purchase_price),
            weight_kg=_round_money(weight),
            exchange_rate_cny_to_rub_adjusted=_round_rate(rate),
            currency_rate_date=config.currency_rate_date,
        ),
        intermediate=Calculator2IntermediatePayload(
            material_cost_cny=_round_money(material_cost_cny),
            intl_delivery_cny=_round_money(intl_delivery_cny),
            packing_cny=_round_money(packing_cny),
            mo_delivery_cny=_round_money(config.mo_delivery_cny),
            total_cny=_round_money(total_cny),
            cost_rub_before_supplier_vat_normalization=_round_money(
                cost_rub_before_supplier_vat_normalization
            ),
            cost_rub_without_supplier_vat=_round_money(cost_rub_without_supplier_vat),
            total_cost_rub_22_vat=_round_money(total_cost_rub_22_vat),
            cost_per_kg_rub_22_vat=_round_money(cost_per_kg_rub_22_vat),
        ),
        constants=Calculator2ConstantsPayload(
            course_cny_to_rub=_round_rate(config.course_cny_to_rub) if config.course_cny_to_rub is not None else None,
            intl_delivery_usd_per_kg=_round_rate(config.intl_delivery_usd_per_kg),
            usd_to_cny_rate=_round_rate(config.usd_to_cny_rate),
            supplier_coefficient=_round_rate(config.supplier_coefficient),
            supplier_vat_divisor=_round_rate(config.supplier_vat_divisor),
            supplier_vat_percent=_round_money(config.supplier_vat_percent),
            our_vat_multiplier=_round_rate(config.our_vat_multiplier),
            our_vat_percent=_round_money(config.our_vat_percent),
            packing_cny_per_kg=_round_money(config.packing_cny_per_kg),
            packing_min_cny=_round_money(config.packing_min_cny),
            mo_delivery_cny=_round_money(config.mo_delivery_cny),
            max_weight_kg=_round_money(config.max_weight_kg),
            rate_markup_percent=_round_money(config.rate_markup_percent),
        ),
        result=Calculator2ResultPayload(
            total_cost_rub=_round_money(total_cost_rub_22_vat),
            cost_per_kg_rub=_round_money(cost_per_kg_rub_22_vat),
            result_label=RESULT_LABEL,
        ),
    )

    result = "\n".join(
        [
            "=== Calculator 2 ===",
            "",
            "Исходные данные:",
            f"1. Закупка в КНР: {_format_money(raw_data.input.purchase_price_cny_per_kg, 'CNY/кг')}",
            f"2. Вес: {_format_weight(raw_data.input.weight_kg)}",
            (
                "3. Курс расчета: "
                f"{_format_money(raw_data.input.exchange_rate_cny_to_rub_adjusted, 'RUB/CNY')}"
            ),
            f"4. Дата курса: {_format_date(raw_data.input.currency_rate_date)}",
            "",
            "Этапы расчета:",
            f"1. Стоимость материала в КНР: {_format_money(raw_data.intermediate.material_cost_cny, 'CNY')}",
            f"2. Международная перевозка: {_format_money(raw_data.intermediate.intl_delivery_cny, 'CNY')}",
            f"3. Упаковка: {_format_money(raw_data.intermediate.packing_cny, 'CNY')}",
            f"4. Доставка по МО: {_format_money(raw_data.intermediate.mo_delivery_cny, 'CNY')}",
            f"5. Итог в CNY: {_format_money(raw_data.intermediate.total_cny, 'CNY')}",
            (
                "6. Стоимость в RUB до нормализации НДС: "
                f"{_format_money(raw_data.intermediate.cost_rub_before_supplier_vat_normalization, 'RUB')}"
            ),
            (
                "7. Стоимость без НДС поставщика: "
                f"{_format_money(raw_data.intermediate.cost_rub_without_supplier_vat, 'RUB')}"
            ),
            (
                "8. Стоимость после приведения к НДС 22%: "
                f"{_format_money(raw_data.intermediate.total_cost_rub_22_vat, 'RUB')}"
            ),
            (
                "9. Стоимость 1 кг: "
                f"{_format_money(raw_data.intermediate.cost_per_kg_rub_22_vat, 'RUB/кг')}"
            ),
            "",
            "Использованные коэффициенты:",
            f"1. Международная перевозка: {_format_money(raw_data.constants.intl_delivery_usd_per_kg, 'USD/кг')}",
            f"2. USD→CNY: {raw_data.constants.usd_to_cny_rate:.2f}",
            f"3. Коэффициент поставщика: {raw_data.constants.supplier_coefficient:.2f}",
            (
                "4. Упаковка: "
                f"{_format_money(raw_data.constants.packing_cny_per_kg, 'CNY/кг')}, минимум "
                f"{_format_money(raw_data.constants.packing_min_cny, 'CNY')}"
            ),
            f"5. Доставка по МО: {_format_money(raw_data.constants.mo_delivery_cny, 'CNY')}",
            f"6. НДС поставщика: {raw_data.constants.supplier_vat_percent:.2f}%",
            f"7. НДС нашей компании: {raw_data.constants.our_vat_percent:.2f}%",
            "",
            f"{RESULT_LABEL}: {_format_money(raw_data.result.total_cost_rub, 'RUB')}",
            f"Себестоимость за 1 кг, RUB/кг: {_format_money(raw_data.result.cost_per_kg_rub, 'RUB/кг')}",
        ]
    )

    return Calculator2Response(result=result, raw_data=raw_data)


def calculate(request: CalculatorRequest) -> CalculatorResponse:
    """
    Совместимость со старым общим маршрутом.
    Calculator 2 реализован отдельным эндпоинтом /calculate/calc-2.
    """
    raw_data = {
        "calculator_type": 2,
        "input": request.dict(),
        "error": "Calculator 2 доступен через отдельный эндпоинт /calculate/calc-2",
    }
    result = "Calculator 2 доступен через отдельный эндпоинт /calculate/calc-2"
    return CalculatorResponse(result=result, raw_data=raw_data)
