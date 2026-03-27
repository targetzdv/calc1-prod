function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") {
    return "";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `${BASE_PATH}/api`;

export interface CalculatorRequest {
  calculator_type: number;
  material: string;
  port_from: string;
  city_to: string;
  railway_station: string;
  quantity: number;
  container_size: string;
  price_per_kg: number;
}

export interface CalculatorRawData {
  calculator_type?: number;
  input?: Record<string, unknown>;
  intermediate?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

export interface CalculatorResponse {
  result: string;
  raw_data: CalculatorRawData;
}

export interface Calculator2Request {
  purchase_price_cny_per_kg: number;
  weight_kg: number;
  exchange_rate_cny_to_rub_adjusted: number;
}

export interface Calculator2Constants {
  intl_delivery_usd_per_kg: number;
  usd_to_cny_rate: number;
  supplier_coefficient: number;
  supplier_vat_divisor: number;
  supplier_vat_percent: number;
  our_vat_multiplier: number;
  our_vat_percent: number;
  packing_cny_per_kg: number;
  packing_min_cny: number;
  mo_delivery_cny: number;
  max_weight_kg: number;
  rate_markup_percent: number;
}

export interface Calculator2Config {
  course_cny_to_rub: number | null;
  exchange_rate_cny_to_rub_adjusted: number | null;
  currency_rate_date: string | null;
  constants: Calculator2Constants;
}

export interface Calculator2Input {
  purchase_price_cny_per_kg: number;
  weight_kg: number;
  exchange_rate_cny_to_rub_adjusted: number;
  currency_rate_date: string | null;
}

export interface Calculator2Intermediate {
  material_cost_cny: number;
  intl_delivery_cny: number;
  packing_cny: number;
  mo_delivery_cny: number;
  total_cny: number;
  cost_rub_before_supplier_vat_normalization: number;
  cost_rub_without_supplier_vat: number;
  total_cost_rub_22_vat: number;
  cost_per_kg_rub_22_vat: number;
}

export interface Calculator2ResultData {
  total_cost_rub: number;
  cost_per_kg_rub: number;
  result_label: string;
}

export interface Calculator2RawData {
  calculator_type: 2;
  input: Calculator2Input;
  intermediate: Calculator2Intermediate;
  constants: Calculator2Constants & {
    course_cny_to_rub: number | null;
  };
  result: Calculator2ResultData;
}

export interface Calculator2Response {
  result: string;
  raw_data: Calculator2RawData;
}

export interface MaterialReference {
  material: string;
  kod: string;
  duty: number;
  calculation_type: string;
}

export interface FreightReference {
  point_a: string;
  point_b: string;
  container: string;
  freight_usd: number;
}

export interface CarDeliveryReference {
  port: string;
  city: string;
  container: string;
  price: number;
}

export interface RailwayDeliveryReference {
  port: string;
  station: string;
  container: string;
  price: number;
}

export interface RailwayCarDeliveryReference {
  station: string;
  city: string;
  container: string;
  price: number;
}

export interface ReferenceData {
  materials: MaterialReference[];
  parameters: Record<string, number>;
  freight: FreightReference[];
  customs_fees: Array<{ min: number; max: number; fee: number }>;
  city_port_map: Record<string, string>;
  car_delivery: CarDeliveryReference[];
  railway_delivery: RailwayDeliveryReference[];
  railway_car_delivery: RailwayCarDeliveryReference[];
}

export interface CurrencyRatePoint {
  date: string;
  rate: number;
}

export interface CurrencyRate {
  code: string;
  name: string;
  current_rate: number;
  weekly_change: number;
  weekly_change_percent: number;
  history: CurrencyRatePoint[];
}

export interface CurrencyRatesData {
  base: "RUB";
  window_days: number;
  generated_at: string;
  source?: string;
  rates: CurrencyRate[];
}

export interface ChinaPortCity {
  city_en: string;
  city_ru: string;
  district: string;
}

export interface ChinaPortCitiesData {
  requested_port: string;
  matched_ports: string[];
  cities: ChinaPortCity[];
  total_cities: number;
}

const NETWORK_ERROR_MESSAGE = `Не удалось подключиться к API (${API_BASE_URL}). Проверьте, что backend запущен.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function extractApiErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const directError = isRecord(payload.error) ? payload.error : null;
  const nestedDetail = isRecord(payload.detail) ? payload.detail : null;
  const errorContainer = directError ?? nestedDetail;

  if (errorContainer) {
    const details = Array.isArray(errorContainer.details)
      ? errorContainer.details
      : [];
    const detailMessages = details
      .map((item) => (isRecord(item) && typeof item.message === "string" ? item.message : null))
      .filter((message): message is string => Boolean(message));

    if (detailMessages.length > 0) {
      return detailMessages.join("; ");
    }

    if (typeof errorContainer.message === "string" && errorContainer.message.trim() !== "") {
      return errorContainer.message;
    }
  }

  if (typeof payload.detail === "string" && payload.detail.trim() !== "") {
    return payload.detail;
  }

  if (typeof payload.message === "string" && payload.message.trim() !== "") {
    return payload.message;
  }

  return null;
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const errorMessage = extractApiErrorMessage(payload);
    throw new Error(errorMessage ?? `Ошибка API: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function calculate(request: CalculatorRequest): Promise<CalculatorResponse> {
  return requestApi<CalculatorResponse>("/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
}

export async function calculateCalc2(request: Calculator2Request): Promise<Calculator2Response> {
  return requestApi<Calculator2Response>("/calculate/calc-2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
}

export async function getReferenceData(): Promise<ReferenceData> {
  const payload = await requestApi<{ data: ReferenceData }>("/data/all");
  return payload.data;
}

export async function getCurrencyRates(days = 7): Promise<CurrencyRatesData> {
  const payload = await requestApi<{ data: CurrencyRatesData }>(
    `/data/currency-rates?days=${days}`,
  );
  return payload.data;
}

export async function getCalculator2Config(): Promise<Calculator2Config> {
  const payload = await requestApi<{ data: Calculator2Config }>("/data/calculator2-config");
  return payload.data;
}

export async function getChinaPortCities(port: string): Promise<ChinaPortCitiesData> {
  const payload = await requestApi<{ data: ChinaPortCitiesData }>(
    `/data/china-port-cities?port=${encodeURIComponent(port)}`,
  );
  return payload.data;
}
