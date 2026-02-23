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

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
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

export async function getChinaPortCities(port: string): Promise<ChinaPortCitiesData> {
  const payload = await requestApi<{ data: ChinaPortCitiesData }>(
    `/data/china-port-cities?port=${encodeURIComponent(port)}`,
  );
  return payload.data;
}
