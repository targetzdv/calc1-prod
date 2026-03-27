"use client";

import { z } from "zod";

export const calculator2Schema = z.object({
  purchase_price_cny_per_kg: z
    .number()
    .positive("Закупка в КНР должна быть больше 0"),
  weight_kg: z
    .number()
    .positive("Вес должен быть больше 0")
    .refine(
      (value) => value <= 100,
      "Для Calculator 2 допустим вес до 100 кг включительно",
    ),
  exchange_rate_cny_to_rub_adjusted: z
    .number()
    .positive("Курс CNY→RUB должен быть больше 0"),
});

export type Calculator2FormData = z.infer<typeof calculator2Schema>;

export const calculator2DefaultValues: Calculator2FormData = {
  purchase_price_cny_per_kg: 0,
  weight_kg: 0,
  exchange_rate_cny_to_rub_adjusted: 0,
};
