"use client";

import { useEffect, useState } from "react";
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
import { CurrencyRatesCard } from "./CurrencyRatesCard";
import { ChinaPortCitiesCard } from "./ChinaPortCitiesCard";
import { Calculator2Screen } from "./calculator2/Calculator2Screen";
import {
  calculate,
  getChinaPortCities,
  getCurrencyRates,
  type CalculatorResponse,
  type ChinaPortCitiesData,
  type CurrencyRatesData,
} from "@/lib/api";

export function Calculator() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [calculation, setCalculation] = useState<CalculatorResponse | null>(null);
  const [currencyData, setCurrencyData] = useState<CurrencyRatesData | null>(null);
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [chinaPortData, setChinaPortData] = useState<ChinaPortCitiesData | null>(null);
  const [chinaPortLoading, setChinaPortLoading] = useState(false);
  const [chinaPortError, setChinaPortError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setCurrencyLoading(true);
    getCurrencyRates(7)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setCurrencyData(data);
        setCurrencyError(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setCurrencyError("Не удалось загрузить курсы валют ЦБ РФ.");
      })
      .finally(() => {
        if (!cancelled) {
          setCurrencyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, value: number) => {
    setActiveTab(value);
    setCalculation(null);
    setChinaPortData(null);
    setChinaPortError(null);
    setError(null);
  };

  const getCalculatorTitle = () => {
    switch (activeTab) {
      case 1:
        return "Контейнер на поставку";
      case 2:
        return "Образец";
      case 3:
        return "Сборный контейнер";
      default:
        return "Калькулятор";
    }
  };

  const getCalculatorDescription = () => {
    switch (activeTab) {
      case 1:
        return "Пошаговый расчёт поставки в контейнерах с каскадной фильтрацией и динамическими справочниками.";
      case 2:
        return "Расчёт доставки образцов до 100 кг через ИП Шмаков с отдельной формой, курсом CNY→RUB и НДС 22%.";
      case 3:
        return "Сценарий сборного контейнера оставлен отдельной вкладкой и пока ещё не реализован.";
      default:
        return "Калькулятор себестоимости.";
    }
  };

  const handleFormSubmit = async (data: CalculatorFormData) => {
    setLoading(true);
    setChinaPortLoading(true);
    setError(null);
    setChinaPortError(null);

    try {
      const [calculationResult, chinaPortResult] = await Promise.allSettled([
        calculate({
          calculator_type: activeTab,
          material: data.material,
          port_from: data.port_from,
          city_to: data.city_to,
          railway_station: data.railway_station ?? "",
          quantity: data.quantity,
          container_size: data.container_size,
          price_per_kg: data.price_per_kg,
        }),
        getChinaPortCities(data.port_from),
      ]);

      if (calculationResult.status === "rejected") {
        throw calculationResult.reason;
      }

      setCalculation(calculationResult.value);

      if (chinaPortResult.status === "fulfilled") {
        setChinaPortData(chinaPortResult.value);
      } else {
        setChinaPortData(null);
        setChinaPortError(
          "Не удалось загрузить список городов для выбранного порта. Проверьте лист china_port_final.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Произошла ошибка при расчёте",
      );
    } finally {
      setLoading(false);
      setChinaPortLoading(false);
    }
  };

  const handleReset = () => {
    setCalculation(null);
    setChinaPortData(null);
    setChinaPortError(null);
    setError(null);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
          gap: { xs: 2.2, lg: 3 },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0, order: { xs: 1, lg: 1 } }}>
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
              {getCalculatorDescription()}
            </Typography>
          </Box>

          <Paper elevation={0} sx={{ mb: 3, p: 1.2 }}>
            <CalculatorTabs value={activeTab} onChange={handleTabChange} />
          </Paper>

          {activeTab === 1 ? (
            <>
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

              <Box sx={{ mt: 3 }}>
                <ChinaPortCitiesCard
                  data={chinaPortData}
                  loading={chinaPortLoading}
                  error={chinaPortError}
                />
              </Box>
            </>
          ) : null}

          {activeTab === 2 ? <Calculator2Screen /> : null}

          {activeTab === 3 ? (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.4, md: 3 },
                border: "1px dashed rgba(142,184,255,0.42)",
                backgroundColor: "rgba(142,184,255,0.06)",
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                Сборный контейнер в работе
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Сценарий пока оставлен изолированным, без общей формы Calculator 1, чтобы не смешивать контракты.
              </Typography>
            </Paper>
          ) : null}
        </Box>

        <Box sx={{ minWidth: 0, order: { xs: 2, lg: 2 } }}>
          <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
            <CurrencyRatesCard
              data={currencyData}
              loading={currencyLoading}
              error={currencyError}
            />
          </Box>
        </Box>
      </Box>

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
