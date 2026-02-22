"use client";

import { Alert, Box, Paper, Typography } from "@mui/material";
import type { CurrencyRatesData } from "@/lib/api";

interface CurrencyRatesCardProps {
  data: CurrencyRatesData | null;
  loading: boolean;
  error: string | null;
}

const formatRate = (value: number) =>
  value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDiff = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

const trendColor = (value: number) => {
  if (value > 0) {
    return "#ffb4a9";
  }
  if (value < 0) {
    return "#9ef0ad";
  }
  return "text.secondary";
};

export function CurrencyRatesCard({ data, loading, error }: CurrencyRatesCardProps) {
  const formatDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) {
      return isoDate;
    }
    return `${day}.${month}.${year}`;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.2,
        p: 1.6,
        border: "1px solid rgba(190,210,235,0.32)",
        background: "rgba(7,15,24,0.62)",
        backdropFilter: "blur(3px)",
        minHeight: { md: 228 },
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.9 }}>
        Курсы к RUB (7 дней)
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Загружаем курсы ЦБ РФ...
        </Typography>
      ) : null}

      {!loading && error ? (
        <Alert severity="warning" sx={{ py: 0 }}>
          {error}
        </Alert>
      ) : null}

      {!loading && !error && !data ? (
        <Typography variant="body2" color="text.secondary">
          Нет данных по курсам.
        </Typography>
      ) : null}

      {!loading && !error && data ? (
        data.rates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Курсы временно недоступны.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.95 }}>
            {data.rates.map((rate) => {
              const historyStart = rate.history[0]?.date ?? "-";
              const historyEnd = rate.history[rate.history.length - 1]?.date ?? "-";

              return (
                <Box
                  key={rate.code}
                  sx={{
                    borderRadius: 1.4,
                    px: 1,
                    py: 0.8,
                    border: "1px solid rgba(190,210,235,0.2)",
                    backgroundColor: "rgba(130,168,228,0.08)",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {rate.code}/RUB
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {formatRate(rate.current_rate)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 0.35,
                      color: trendColor(rate.weekly_change),
                      fontWeight: 600,
                    }}
                  >
                    7д: {formatDiff(rate.weekly_change)} RUB ({formatPercent(rate.weekly_change_percent)})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(historyStart)} - {formatDate(historyEnd)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )
      ) : null}
    </Paper>
  );
}
