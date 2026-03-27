"""
Unified reference data repository with switchable source:
- local: read static JSON from disk
- sheets: read from Google Sheets
- auto: try Google Sheets, fallback to local JSON
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from repositories.sheets_repo import SheetsRepository

logger = logging.getLogger(__name__)


class LocalDataRepository:
    """Read reference data from local JSON file."""

    def __init__(self):
        default_path = Path(__file__).resolve().parent.parent / "data" / "reference_data.local.json"
        self.data_path = Path(os.getenv("LOCAL_DATA_PATH", str(default_path)))
        self._data: Optional[Dict[str, Any]] = None
        self._mtime_ns: Optional[int] = None

    def _load_data(self) -> Dict[str, Any]:
        mtime_ns = self.data_path.stat().st_mtime_ns
        if self._data is None or self._mtime_ns != mtime_ns:
            with self.data_path.open("r", encoding="utf-8") as f:
                self._data = json.load(f)
            self._mtime_ns = mtime_ns
        return self._data

    def invalidate_cache(self, sheet_name: Optional[str] = None):
        # No cache layer for local JSON source.
        _ = sheet_name

    def get_materials(self) -> List[Dict[str, Any]]:
        return self._load_data().get("materials", [])

    def get_parameters(self) -> Dict[str, float]:
        return self._load_data().get("parameters", {})

    def get_freight(self) -> List[Dict[str, Any]]:
        return self._load_data().get("freight", [])

    def get_customs_fees(self) -> List[Dict[str, Any]]:
        return self._load_data().get("customs_fees", [])

    def get_city_port_map(self) -> Dict[str, str]:
        return self._load_data().get("city_port_map", {})

    def get_car_delivery(self) -> List[Dict[str, Any]]:
        return self._load_data().get("car_delivery", [])

    def get_railway_delivery(self) -> List[Dict[str, Any]]:
        return self._load_data().get("railway_delivery", [])

    def get_railway_car_delivery(self) -> List[Dict[str, Any]]:
        return self._load_data().get("railway_car_delivery", [])

    def get_all_data(self) -> Dict[str, Any]:
        return self._load_data()

    def get_calculator2_parameters(self) -> Dict[str, Any]:
        return self._load_data().get("calculator2_parameters", {})


class ReferenceDataRepository:
    """Facade over sheets/local sources."""

    def __init__(self):
        self.mode = os.getenv("REFERENCE_DATA_SOURCE", "sheets").strip().lower()
        if self.mode not in {"local", "sheets", "auto"}:
            logger.warning("Unknown REFERENCE_DATA_SOURCE='%s', fallback to 'sheets'", self.mode)
            self.mode = "sheets"
        self.local_repo = LocalDataRepository()
        self.sheets_repo = SheetsRepository()

    def _call(self, method_name: str, *args):
        local_method = getattr(self.local_repo, method_name)
        sheets_method = getattr(self.sheets_repo, method_name)

        if self.mode == "local":
            return local_method(*args)

        if self.mode == "sheets":
            return sheets_method(*args)

        # auto mode: sheets first, local fallback
        try:
            return sheets_method(*args)
        except Exception:
            logger.exception("Sheets source failed for '%s', fallback to local JSON", method_name)
            return local_method(*args)

    def invalidate_cache(self, sheet_name: Optional[str] = None):
        if self.mode == "local":
            self.local_repo.invalidate_cache(sheet_name)
            return

        if self.mode == "sheets":
            self.sheets_repo.invalidate_cache(sheet_name)
            return

        # auto mode
        try:
            self.sheets_repo.invalidate_cache(sheet_name)
        except Exception:
            logger.exception("Failed to invalidate sheets cache")
        self.local_repo.invalidate_cache(sheet_name)

    def get_materials(self) -> List[Dict[str, Any]]:
        return self._call("get_materials")

    def get_parameters(self) -> Dict[str, float]:
        return self._call("get_parameters")

    def get_freight(self) -> List[Dict[str, Any]]:
        return self._call("get_freight")

    def get_customs_fees(self) -> List[Dict[str, Any]]:
        return self._call("get_customs_fees")

    def get_city_port_map(self) -> Dict[str, str]:
        return self._call("get_city_port_map")

    def get_car_delivery(self) -> List[Dict[str, Any]]:
        return self._call("get_car_delivery")

    def get_railway_delivery(self) -> List[Dict[str, Any]]:
        return self._call("get_railway_delivery")

    def get_railway_car_delivery(self) -> List[Dict[str, Any]]:
        return self._call("get_railway_car_delivery")

    def get_all_data(self) -> Dict[str, Any]:
        return self._call("get_all_data")

    def get_calculator2_parameters(self) -> Dict[str, Any]:
        return self._call("get_calculator2_parameters")


reference_data_repo = ReferenceDataRepository()
