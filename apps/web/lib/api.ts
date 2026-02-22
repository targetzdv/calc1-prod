const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const RETRYABLE_API_STATUSES = new Set([404, 502, 503, 504]);

function getApiBaseCandidates(): string[] {
  const candidates = [
    API_BASE_URL,
    "/api",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8010",
    "http://localhost:8010",
  ];

  return Array.from(new Set(candidates.map((item) => item.trim()).filter(Boolean))).map((base) =>
    base.endsWith("/") ? base.slice(0, -1) : base,
  );
}

async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  const bases = getApiBaseCandidates();
  let lastError: Error | null = null;

  for (let index = 0; index < bases.length; index += 1) {
    const base = bases[index]!;
    const url = `${base}${path}`;

    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return response;
      }

      const canRetry =
        index < bases.length - 1 && RETRYABLE_API_STATUSES.has(response.status) && (base === "/api" || base === API_BASE_URL);

      if (!canRetry) {
        throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
      }

      lastError = new Error(`Ошибка API: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error("Неизвестная ошибка при запросе к API");
      }
    }
  }

  throw lastError ?? new Error("Не удалось выполнить запрос к API");
}

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

export async function calculate(request: CalculatorRequest): Promise<CalculatorResponse> {
  const response = await requestApi("/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

export async function getReferenceData(): Promise<ReferenceData> {
  const response = await requestApi("/data/all");

  const payload = (await response.json()) as { data: ReferenceData };
  return payload.data;
}
