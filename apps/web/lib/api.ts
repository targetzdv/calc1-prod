const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const response = await fetch(`${API_BASE_URL}/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getReferenceData(): Promise<ReferenceData> {
  const response = await fetch(`${API_BASE_URL}/data/all`);

  if (!response.ok) {
    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data: ReferenceData };
  return payload.data;
}
