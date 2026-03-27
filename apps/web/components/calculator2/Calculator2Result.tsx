"use client";

import { useState } from "react";
import { Box, Button, Divider, Grid, Paper, Typography } from "@mui/material";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";

import type { Calculator2Response } from "@/lib/api";
import type { Calculator2CopyStatus, Calculator2DisplayRow } from "./calculator2.types";

interface Calculator2ResultProps {
  calculation: Calculator2Response | null;
}

const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const formatCurrency = (value: number, unit: string) => `${formatNumber(value)} ${unit}`;

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  }

  return value;
};

export function Calculator2Result({ calculation }: Calculator2ResultProps) {
  const [copyStatus, setCopyStatus] = useState<Calculator2CopyStatus>("idle");

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
          Результат расчёта
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Заполните форму и нажмите «Рассчитать»
        </Typography>
      </Paper>
    );
  }

  const { input, intermediate, constants, result } = calculation.raw_data;

  const inputRows: Calculator2DisplayRow[] = [
    {
      key: "purchase_price",
      label: "Закупка в КНР",
      value: formatCurrency(input.purchase_price_cny_per_kg, "CNY/кг"),
    },
    {
      key: "weight",
      label: "Вес",
      value: formatCurrency(input.weight_kg, "кг"),
    },
    {
      key: "rate",
      label: "Курс расчёта",
      value: formatCurrency(input.exchange_rate_cny_to_rub_adjusted, "RUB/CNY"),
    },
    {
      key: "rate_date",
      label: "Дата актуальности курса",
      value: formatDate(input.currency_rate_date),
    },
  ];

  const stepRows: Calculator2DisplayRow[] = [
    {
      key: "material_cost",
      label: "Стоимость материала в КНР",
      value: formatCurrency(intermediate.material_cost_cny, "CNY"),
    },
    {
      key: "intl_delivery",
      label: "Международная перевозка",
      value: formatCurrency(intermediate.intl_delivery_cny, "CNY"),
    },
    {
      key: "packing",
      label: "Упаковка",
      value: formatCurrency(intermediate.packing_cny, "CNY"),
    },
    {
      key: "mo_delivery",
      label: "Доставка по МО",
      value: formatCurrency(intermediate.mo_delivery_cny, "CNY"),
    },
    {
      key: "total_cny",
      label: "Итог в CNY",
      value: formatCurrency(intermediate.total_cny, "CNY"),
    },
    {
      key: "before_supplier_vat",
      label: "Стоимость в RUB до нормализации НДС",
      value: formatCurrency(intermediate.cost_rub_before_supplier_vat_normalization, "RUB"),
    },
    {
      key: "without_supplier_vat",
      label: "Стоимость без НДС поставщика",
      value: formatCurrency(intermediate.cost_rub_without_supplier_vat, "RUB"),
    },
    {
      key: "after_22_vat",
      label: "Стоимость после приведения к НДС 22%",
      value: formatCurrency(intermediate.total_cost_rub_22_vat, "RUB"),
    },
    {
      key: "cost_per_kg",
      label: "Стоимость 1 кг",
      value: formatCurrency(intermediate.cost_per_kg_rub_22_vat, "RUB/кг"),
    },
  ];

  const constantRows: Calculator2DisplayRow[] = [
    {
      key: "intl_delivery_usd_per_kg",
      label: "Международная перевозка",
      value: formatCurrency(constants.intl_delivery_usd_per_kg, "USD/кг"),
    },
    {
      key: "usd_to_cny_rate",
      label: "USD→CNY",
      value: formatNumber(constants.usd_to_cny_rate, 2),
    },
    {
      key: "supplier_coefficient",
      label: "Коэффициент поставщика",
      value: formatNumber(constants.supplier_coefficient, 2),
    },
    {
      key: "packing",
      label: "Упаковка",
      value: `${formatCurrency(constants.packing_cny_per_kg, "CNY/кг")}, минимум ${formatCurrency(constants.packing_min_cny, "CNY")}`,
    },
    {
      key: "mo_delivery_cny",
      label: "Доставка по МО",
      value: formatCurrency(constants.mo_delivery_cny, "CNY"),
    },
    {
      key: "supplier_vat_percent",
      label: "НДС поставщика",
      value: `${formatNumber(constants.supplier_vat_percent, 2)}%`,
    },
    {
      key: "our_vat_percent",
      label: "НДС нашей компании",
      value: `${formatNumber(constants.our_vat_percent, 2)}%`,
    },
  ];

  const renderRows = (rows: Calculator2DisplayRow[]) => (
    <Box>
      {rows.map((row, index) => (
        <Box key={row.key}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(170px, 38%) 1fr" },
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
                textAlign: { xs: "left", md: "right" },
                justifySelf: { xs: "start", md: "end" },
                fontVariantNumeric: "tabular-nums",
                wordBreak: "break-word",
              }}
            >
              {row.value}
            </Typography>
          </Box>
          {index < rows.length - 1 ? (
            <Divider sx={{ borderColor: "rgba(190,210,235,0.16)" }} />
          ) : null}
        </Box>
      ))}
    </Box>
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(calculation.result);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Не удалось скопировать результат Calculator 2:", error);
      setCopyStatus("error");
    }

    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

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
            {renderRows(stepRows)}
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
              Использованные коэффициенты
            </Typography>
            {renderRows(constantRows)}
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
            <Typography variant="caption" color="text.secondary">
              {result.result_label}
            </Typography>
            <Typography
              sx={{
                mt: 0.2,
                fontWeight: 700,
                fontSize: { xs: "1.7rem", md: "1.88rem" },
                lineHeight: 1.15,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
              }}
            >
              {formatCurrency(result.total_cost_rub, "RUB")}
            </Typography>

            <Divider sx={{ my: 1.8, borderColor: "rgba(190,210,235,0.22)" }} />

            <Typography variant="caption" color="text.secondary">
              Себестоимость за 1 кг, RUB/кг
            </Typography>
            <Typography
              sx={{
                mt: 0.2,
                fontWeight: 700,
                fontSize: { xs: "1.7rem", md: "1.88rem" },
                lineHeight: 1.15,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
              }}
            >
              {formatCurrency(result.cost_per_kg_rub, "RUB/кг")}
            </Typography>
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
                  : "Скопировать весь расчёт"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
