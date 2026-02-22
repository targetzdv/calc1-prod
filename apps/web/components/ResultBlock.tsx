"use client";

import { useState } from "react";
import { Paper, Typography, Box, Grid, Divider, Button, TextField } from "@mui/material";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import type { CalculatorResponse } from "@/lib/api";

interface ResultBlockProps {
  calculation: CalculatorResponse | null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const asText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "-";
};

const formatMoney = (value: number | null, suffix = "₽") => {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${suffix}`;
};

const formatQuantity = (value: number | null) => {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} кг`;
};

const formatPrice = (value: number | null) => {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ¥/кг`;
};

const formatPercent = (value: number | null) => {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

type StepRow = {
  key: string;
  label: string;
  value: string;
};

export function ResultBlock({ calculation }: ResultBlockProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [sellPricePerKg, setSellPricePerKg] = useState<string>("");

  if (!calculation) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          minHeight: 300,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "1px dashed rgba(142,184,255,0.52)",
          backgroundColor: "rgba(142,184,255,0.08)",
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          🧾 Результат расчёта
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Заполните форму и нажмите «Рассчитать»
        </Typography>
      </Paper>
    );
  }

  const rawData = asRecord(calculation.raw_data);
  const input = asRecord(rawData.input);
  const intermediate = asRecord(rawData.intermediate);
  const result = asRecord(rawData.result);

  const material = asText(input.material);
  const portFrom = asText(input.port_from);
  const portTo = asText(input.port_to);
  const cityTo = asText(input.city_to);
  const railwayStation = asText(input.railway_station);
  const containerSize = asText(input.container_size);
  const quantity = asNumber(input.quantity);
  const pricePerKg = asNumber(input.price_per_kg);
  const freightUsd = asNumber(intermediate.freight_usd);

  const hasStation = railwayStation !== "-" && railwayStation !== "";
  const route = hasStation
    ? `${portFrom} → ${portTo} → ${railwayStation} → ${cityTo}`
    : `${portFrom} → ${portTo !== "-" ? `${portTo} → ` : ""}${cityTo}`;

  const stepRows: StepRow[] = [];
  const addStep = (key: string, label: string, value: number | null, suffix = "₽") => {
    if (value !== null) {
      stepRows.push({ key, label, value: formatMoney(value, suffix) });
    }
  };

  addStep("purchase_sum_rub", "Закупка (RUB)", asNumber(intermediate.purchase_sum_rub));
  addStep("freight_rub", "Фрахт (RUB)", asNumber(intermediate.freight_rub));
  addStep("customs_value_rub", "Таможенная стоимость", asNumber(intermediate.customs_value_rub));
  addStep("duty_rub", "Пошлина", asNumber(intermediate.duty_rub));
  addStep("customs_fee_rub", "Таможенный сбор", asNumber(intermediate.customs_fee_rub));
  addStep("vat_rub", "НДС", asNumber(intermediate.vat_rub));
  addStep("broker_rub", "Брокер", asNumber(intermediate.broker_rub));

  const deliveryType = asText(intermediate.delivery_type);
  const isRailwayRoute = deliveryType.includes("ЖД");
  const railwayRub = asNumber(intermediate.railway_rub);
  const railwayCarRub = asNumber(intermediate.railway_car_rub);
  const deliveryRub = asNumber(intermediate.delivery_rub);

  if (isRailwayRoute) {
    addStep("railway_rub", "Доставка по ЖД в РФ", railwayRub);
    addStep("railway_car_rub", "Доставка от ЖД до склада", railwayCarRub);
  } else {
    addStep("delivery_rub", "Доставка с порта на склад", deliveryRub);
  }

  addStep("bank_fee_rub", "Банковская комиссия", asNumber(intermediate.bank_fee_rub));

  const totalCost =
    asNumber(result.total_cost_rub) ?? asNumber(result.total_cost) ?? asNumber(intermediate.total_cost_rub);
  const costPerKg = asNumber(result.cost_per_kg);

  const inputRows: StepRow[] = [
    { key: "material", label: "Материал", value: material },
    { key: "route", label: "Маршрут", value: route },
    { key: "container", label: "Контейнер", value: containerSize },
    { key: "quantity", label: "Количество", value: formatQuantity(quantity) },
    { key: "price", label: "Цена", value: formatPrice(pricePerKg) },
    { key: "freight", label: "Фрахт", value: freightUsd !== null ? formatMoney(freightUsd, "USD") : "-" },
  ];

  const totalCostText = formatMoney(totalCost);
  const costPerKgText = costPerKg !== null ? `${formatMoney(costPerKg)} / кг` : "-";
  const sellPriceNumber = asNumber(sellPricePerKg);
  const marginPerKg =
    sellPriceNumber !== null && costPerKg !== null ? sellPriceNumber - costPerKg : null;
  const marginPercent =
    marginPerKg !== null && costPerKg !== null && costPerKg !== 0
      ? (marginPerKg / costPerKg) * 100
      : null;
  const totalMargin =
    marginPerKg !== null && quantity !== null ? marginPerKg * quantity : null;

  const copyPayload = [
    "Результат расчёта",
    "",
    "Исходные данные:",
    ...inputRows.map((row, index) => `${index + 1}. ${row.label}: ${row.value}`),
    "",
    "Этапы расчёта:",
    ...(stepRows.length > 0
      ? stepRows.map((row, index) => `${index + 1}. ${row.label}: ${row.value}`)
      : ["Для этого калькулятора детальные этапы пока не доступны."]),
    "",
    `Полная себестоимость: ${totalCostText}`,
    `Себестоимость за 1 кг: ${costPerKgText}`,
  ].join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Не удалось скопировать результат:", error);
      setCopyStatus("error");
    }

    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  const renderRows = (rows: StepRow[]) => (
    <Box>
      {rows.map((row, index) => (
        <Box key={row.key}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr auto", md: "minmax(170px, 38%) 1fr" },
              alignItems: "start",
              gap: 1,
              py: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {index + 1}. {row.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                textAlign: "right",
                justifySelf: "end",
                fontVariantNumeric: "tabular-nums",
                wordBreak: "break-word",
              }}
            >
              {row.value}
            </Typography>
          </Box>
          {index < rows.length - 1 ? <Divider sx={{ borderColor: "rgba(190,210,235,0.16)" }} /> : null}
        </Box>
      ))}
    </Box>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        minHeight: 300,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          right: -38,
          bottom: -58,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(142,184,255,0.26) 0%, rgba(142,184,255,0) 68%)",
        },
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <InsightsRoundedIcon />
        Результат расчёта
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1px solid rgba(190,210,235,0.24)",
              backgroundColor: "rgba(140,176,232,0.06)",
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
              Исходные данные
            </Typography>
            {renderRows(inputRows)}
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1px solid rgba(190,210,235,0.24)",
              backgroundColor: "rgba(140,176,232,0.06)",
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
              Этапы расчёта
            </Typography>
            {stepRows.length > 0 ? (
              renderRows(stepRows)
            ) : (
              <Typography variant="body2" color="text.secondary">
                Для этого калькулятора детальные этапы пока не доступны.
              </Typography>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              p: { xs: 2, md: 2.4 },
              borderRadius: 2.5,
              border: "1px solid rgba(168, 200, 255, 0.42)",
              background:
                "linear-gradient(110deg, rgba(140,176,232,0.18) 0%, rgba(140,176,232,0.12) 45%, rgba(140,176,232,0.06) 100%)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1.6,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Итоги расчёта
              </Typography>
              <Box
                sx={{
                  px: 1.1,
                  py: 0.35,
                  borderRadius: 99,
                  fontSize: "0.72rem",
                  lineHeight: 1.2,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#e5eefc",
                  border: "1px solid rgba(168,200,255,0.5)",
                  backgroundColor: "rgba(168,200,255,0.12)",
                }}
              >
                С НДС
              </Box>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" },
                alignItems: "center",
                columnGap: 2,
                rowGap: 1.4,
              }}
            >
              <Box sx={{ textAlign: { xs: "left", md: "left" } }}>
                <Typography variant="caption" color="text.secondary">
                  Полная себестоимость
                </Typography>
                <Typography
                  sx={{
                    mt: 0.2,
                    fontWeight: 700,
                    fontSize: { xs: "1.7rem", md: "1.88rem" },
                    lineHeight: 1.15,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {totalCostText}
                </Typography>
              </Box>

              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  display: { xs: "none", md: "block" },
                  borderColor: "rgba(190,210,235,0.28)",
                }}
              />
              <Divider
                sx={{
                  display: { xs: "block", md: "none" },
                  borderColor: "rgba(190,210,235,0.2)",
                }}
              />

              <Box sx={{ textAlign: { xs: "left", md: "left" } }}>
                <Typography variant="caption" color="text.secondary">
                  Себестоимость за 1 кг
                </Typography>
                <Typography
                  sx={{
                    mt: 0.2,
                    fontWeight: 700,
                    fontSize: { xs: "1.7rem", md: "1.88rem" },
                    lineHeight: 1.15,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {costPerKgText}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1px solid rgba(190,210,235,0.24)",
              backgroundColor: "rgba(140,176,232,0.06)",
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1.2, fontWeight: 600 }}>
              Оценка маржи
            </Typography>

            <TextField
              value={sellPricePerKg}
              onChange={(event) => setSellPricePerKg(event.target.value)}
              type="number"
              fullWidth
              label="Цена продажи за 1 кг (RUB)"
              InputProps={{
                inputProps: { step: 0.01, min: 0 },
              }}
              helperText="Укажите плановую цену продажи, чтобы увидеть маржинальность"
            />

            <Box
              sx={{
                mt: 1.5,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1.2,
              }}
            >
              <Box sx={{ p: 1.2, borderRadius: 1.6, backgroundColor: "rgba(255,255,255,0.04)" }}>
                <Typography variant="caption" color="text.secondary">
                  Маржа за 1 кг
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.2 }}>
                  {formatMoney(marginPerKg)}
                </Typography>
              </Box>

              <Box sx={{ p: 1.2, borderRadius: 1.6, backgroundColor: "rgba(255,255,255,0.04)" }}>
                <Typography variant="caption" color="text.secondary">
                  Маржинальность
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.2 }}>
                  {formatPercent(marginPercent)}
                </Typography>
              </Box>

              <Box sx={{ p: 1.2, borderRadius: 1.6, backgroundColor: "rgba(255,255,255,0.04)" }}>
                <Typography variant="caption" color="text.secondary">
                  Общая маржа
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.2 }}>
                  {formatMoney(totalMargin)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", md: "flex-end" } }}>
            <Button
              type="button"
              variant="outlined"
              onClick={handleCopy}
              sx={{
                width: { xs: "100%", md: "auto" },
                minWidth: { md: 260 },
                borderColor: "rgba(130,242,82,0.85)",
                color: "#8cf659",
                backgroundColor: "rgba(130,242,82,0.08)",
                fontSize: "1rem",
                fontWeight: 700,
                "&:hover": {
                  borderColor: "#8cf659",
                  backgroundColor: "rgba(130,242,82,0.15)",
                },
              }}
            >
              {copyStatus === "copied"
                ? "Скопировано"
                : copyStatus === "error"
                  ? "Ошибка копирования"
                  : "Скопировать результат"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
