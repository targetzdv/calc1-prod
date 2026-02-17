from .calculator1 import calculate as calculate1
from .calculator2 import calculate as calculate2
from .calculator3 import calculate as calculate3

CALCULATORS = {
    1: calculate1,
    2: calculate2,
    3: calculate3,
}

__all__ = ["CALCULATORS", "calculate1", "calculate2", "calculate3"]
