from models.CalculatorRequest import CalculatorRequest
from models.CalculatorResponse import CalculatorResponse


def calculate(request: CalculatorRequest) -> CalculatorResponse:
    """
    Калькулятор 2 - заглушка

    TODO: Реализовать полную логику расчёта на Этапе 9
    """
    raw_data = {
        "calculator_type": 2,
        "input": request.dict(),
        "result": {
            "total_cost": 15000.0,
            "cost_per_kg": 15.0,
        },
    }

    result = f"""=== Результат расчёта (Калькулятор 2) ===

Исходные данные:
• Материал: {request.material}
• Количество: {request.quantity:,} кг
• Размер контейнера: {request.container_size}
• Цена за кг: {request.price_per_kg:.2f} ¥

Итого: {raw_data["result"]["total_cost"]:,.2f} ₽
За 1 кг: {raw_data["result"]["cost_per_kg"]:.2f} ₽
"""

    return CalculatorResponse(result=result, raw_data=raw_data)
