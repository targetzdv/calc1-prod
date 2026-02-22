"""
Repository for official CBR currency rates (RUB base) with Redis cache.
"""
from __future__ import annotations

import json
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import urlopen
import xml.etree.ElementTree as ET

import redis


class CurrencyRepository:
    """Loads weekly currency dynamics for USD/EUR/CNY from CBR XML API."""

    CURRENCIES = {
        "USD": {"id": "R01235", "name": "US Dollar"},
        "EUR": {"id": "R01239", "name": "Euro"},
        "CNY": {"id": "R01375", "name": "Chinese Yuan"},
    }

    def __init__(self) -> None:
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.cache_ttl = int(os.getenv("CURRENCY_CACHE_TTL", "3600"))
        self.cbr_base_url = os.getenv("CBR_XML_BASE_URL", "https://www.cbr.ru/scripts")
        self.fetch_timeout_seconds = int(os.getenv("CBR_FETCH_TIMEOUT_SECONDS", "18"))
        self.fetch_retries = int(os.getenv("CBR_FETCH_RETRIES", "2"))
        self.redis_client = self._create_redis_client()

    def _create_redis_client(self):
        try:
            client = redis.from_url(self.redis_url, decode_responses=True)
            client.ping()
            return client
        except Exception:
            return None

    def _parse_number(self, value: Optional[str]) -> Optional[float]:
        if not value:
            return None
        cleaned = value.replace("\xa0", "").replace(" ", "").replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _build_dynamic_url(self, currency_id: str, start: date, end: date) -> str:
        query = urlencode(
            {
                "date_req1": start.strftime("%d/%m/%Y"),
                "date_req2": end.strftime("%d/%m/%Y"),
                "VAL_NM_RQ": currency_id,
            }
        )
        return f"{self.cbr_base_url}/XML_dynamic.asp?{query}"

    def _fetch_series(self, currency_id: str, start: date, end: date) -> List[Dict[str, Any]]:
        url = self._build_dynamic_url(currency_id, start, end)
        payload = None
        last_error: Optional[Exception] = None

        for attempt in range(self.fetch_retries + 1):
            try:
                with urlopen(url, timeout=self.fetch_timeout_seconds) as response:
                    payload = response.read()
                last_error = None
                break
            except Exception as error:
                last_error = error
                if attempt < self.fetch_retries:
                    time.sleep(min(0.35 * (attempt + 1), 1.0))

        if payload is None:
            if last_error is not None:
                raise last_error
            raise RuntimeError("Unable to fetch CBR series")

        root = ET.fromstring(payload)
        history: List[Dict[str, Any]] = []

        for record in root.findall("Record"):
            date_text = record.attrib.get("Date")
            nominal = self._parse_number(record.findtext("Nominal"))
            value = self._parse_number(record.findtext("Value"))

            if not date_text or nominal in (None, 0) or value is None:
                continue

            parsed_date = datetime.strptime(date_text, "%d.%m.%Y").date().isoformat()
            history.append(
                {
                    "date": parsed_date,
                    "rate": round(value / nominal, 4),
                }
            )

        history.sort(key=lambda item: item["date"])
        return history

    def get_weekly_rates(self, days: int = 7) -> Dict[str, Any]:
        days = max(2, min(days, 14))
        end = date.today()
        start = end - timedelta(days=days - 1)

        cache_key = f"currency:weekly:{start.isoformat()}:{end.isoformat()}"
        if self.redis_client is not None:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        rates: List[Dict[str, Any]] = []
        for code, meta in self.CURRENCIES.items():
            history = self._fetch_series(meta["id"], start, end)
            if not history:
                continue

            first_rate = history[0]["rate"]
            current_rate = history[-1]["rate"]
            diff = round(current_rate - first_rate, 4)
            pct = round((diff / first_rate) * 100, 3) if first_rate else 0.0

            rates.append(
                {
                    "code": code,
                    "name": meta["name"],
                    "current_rate": current_rate,
                    "weekly_change": diff,
                    "weekly_change_percent": pct,
                    "history": history,
                }
            )

        if not rates:
            raise RuntimeError("Unable to load CBR rates")

        payload = {
            "base": "RUB",
            "window_days": days,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "rates": rates,
        }

        if self.redis_client is not None:
            try:
                self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(payload))
            except Exception:
                pass
        return payload


currency_repo = CurrencyRepository()
