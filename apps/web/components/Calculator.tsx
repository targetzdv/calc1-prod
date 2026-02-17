"use client";

import { useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Container,
  Grid,
  Alert,
  Snackbar,
  Chip,
  Stack,
} from "@mui/material";
import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { CalculatorTabs } from "./CalculatorTabs";
import { ResultBlock } from "./ResultBlock";
import { FormInputs, type CalculatorFormData } from "./FormInputs";
import { calculate, type CalculatorResponse } from "@/lib/api";

export function Calculator() {
  const [activeTab, setActiveTab] = useState(1);
  const [calculation, setCalculation] = useState<CalculatorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (_event: React.SyntheticEvent, value: number) => {
    setActiveTab(value);
    setCalculation(null);
  };

  const getCalculatorTitle = () => {
    switch (activeTab) {
      case 1:
        return "Калькулятор 1 — Себестоимость поставки";
      case 2:
        return "Калькулятор 2 — какое-то название";
      case 3:
        return "Калькулятор 3 — какое-то название";
      default:
        return "Калькулятор";
    }
  };

  const handleFormSubmit = async (data: CalculatorFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response: CalculatorResponse = await calculate({
        calculator_type: activeTab,
        material: data.material,
        port_from: data.port_from,
        city_to: data.city_to,
        railway_station: data.railway_station ?? "",
        quantity: data.quantity,
        container_size: data.container_size,
        price_per_kg: data.price_per_kg,
      });

      setCalculation(response);
    } catch (error) {
      console.error("Ошибка расчёта:", error);
      setError(
        error instanceof Error ? error.message : "Произошла ошибка при расчёте",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCalculation(null);
    setError(null);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          position: "relative",
          borderRadius: { xs: 2, md: 2.4 },
          px: { xs: 2.2, md: 3.5 },
          py: { xs: 2.2, md: 3 },
          mb: 3,
          overflow: "hidden",
          border: "1px solid rgba(190,210,235,0.34)",
          background:
            "linear-gradient(132deg, rgba(90,118,161,0.42) 0%, rgba(41,62,94,0.26) 38%, rgba(13,23,37,0.28) 100%)",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.42)",
          "&::after": {
            content: '""',
            position: "absolute",
            right: -34,
            top: -34,
            width: 160,
            height: 160,
            background:
              "radial-gradient(circle, rgba(142,184,255,0.38) 0%, rgba(142,184,255,0.06) 58%, transparent 74%)",
          },
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} mb={1.4}>
          <Chip
            icon={<LocalShippingRoundedIcon fontSize="small" />}
            label="Морская логистика"
            sx={{ width: "fit-content", bgcolor: "rgba(142,184,255,0.18)", color: "#e0ebff" }}
          />
          <Chip
            icon={<TrendingUpRoundedIcon fontSize="small" />}
            label="Себестоимость и маржинальность"
            sx={{ width: "fit-content", bgcolor: "rgba(255,255,255,0.06)", color: "text.secondary" }}
          />
        </Stack>
        <Typography
          variant="h4"
          component="h1"
          sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}
        >
          <CalculateRoundedIcon />
          {getCalculatorTitle()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Пошаговый расчёт поставки в контейнерах с каскадной фильтрацией и динамическими справочниками.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ mb: 3, p: 1.2 }}>
        <CalculatorTabs value={activeTab} onChange={handleTabChange} />
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, minHeight: 300 }}>
            <Typography variant="h6" gutterBottom>
              Исходные данные
            </Typography>
            <FormInputs
              onSubmit={handleFormSubmit}
              loading={loading}
              onReset={handleReset}
            />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ResultBlock calculation={calculation} />
        </Grid>
      </Grid>

      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}
