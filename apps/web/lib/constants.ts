// Константы для формы калькулятора на основе данных из Google Sheets

// Материалы
export const MATERIALS = [
  "АБС",
  "PPS, PSU, PPSU",
  "HDPE",
  "POM",
  "PEEK",
  "PA-6/66",
  "LLDPE",
  "PC, PBT",
  "TPU",
  "PMMA",
  "полибензимидазол",
] as const;

// Контейнеры
export const CONTAINER_SIZES = ["20ft", "40ft"] as const;

// Китайские порты (порт отправления)
export const PORTS_FROM = [
  "Dalian",
  "Nansha",
  "Ningbo",
  "Qingdao",
  "Shanghai",
  "Yantian",
] as const;

// Город-Порт маппинг
export const CITY_PORT_MAP = {
  Лакинск: "Новороссийск",
  Краснодар: "Новороссийск",
  "Ростов на Дону": "Новороссийск",
  Невинномысск: "Новороссийск",
  Москва: "Новороссийск",
  "Санкт-Петербург": "Новороссийск",
  Кисловодск: "Новороссийск",
  Минск: "Новороссийск",
  Брест: "Новороссийск",
  Смоленск: "Новороссийск",
  Казань: "Новороссийск",
  Кобрин: "Новороссийск",
  Волжский: "Новороссийск",
  Узловая: "Новороссийск",
  Рязань: "Новороссийск",
  Новосибирск: "Владивосток",
  Ангарск: "Владивосток",
  Иркутск: "Владивосток",
  Екатеринбург: "Владивосток",
} as const;

// Города для select
export const CITIES = Object.keys(
  CITY_PORT_MAP,
) as readonly (typeof CITY_PORT_MAP)[keyof typeof CITY_PORT_MAP][];

// Порты для select
export const PORTS = Array.from(
  new Set(Object.values(CITY_PORT_MAP)),
) as readonly string[];

// ЖД станции (порт -> станции)
export const RAILWAY_STATIONS: Record<string, string[]> = {
  Владивосток: [
    "батарейная",
    "Клещиха",
    "Екатеринбург",
    "Москва",
    "Ангарск_станция",
  ],
  Новороссийск: ["Батарейная", "Клещиха", "Москва", "Лакинск"],
} as const;

// Все ЖД станции
export const ALL_RAILWAY_STATIONS = Object.values(
  RAILWAY_STATIONS,
).flat() as readonly string[];
