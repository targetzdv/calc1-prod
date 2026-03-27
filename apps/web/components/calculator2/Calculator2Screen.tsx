"use client";

import { useEffect, useState } from "react";
import { Alert, Grid, Paper, Snackbar, Typography } from "@mui/material";

import {
  calculateCalc2,
  getCalculator2Config,
  type Calculator2Config,
  type Calculator2Response,
} from "@/lib/api";
import { Calculator2Form } from "./Calculator2Form";
import { Calculator2Result } from "./Calculator2Result";
import type { Calculator2FormData } from "./calculator2.schema";

export function Calculator2Screen() {
  const [calculation, setCalculation] = useState<Calculator2Response | null>(null);
  const [config, setConfig] = useState<Calculator2Config | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setConfigLoading(true);
    getCalculator2Config()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setConfig(payload);
        setConfigError(null);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        setConfig(null);
        setConfigError(
          fetchError instanceof Error
            ? fetchError.message
            : "Не удалось загрузить конфигурацию Calculator 2. Курс можно ввести вручную.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setConfigLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (data: Calculator2FormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateCalc2(data);
      setCalculation(response);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Произошла ошибка при расчёте Calculator 2",
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
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, minHeight: 300 }}>
            <Typography variant="h6" gutterBottom>
              Исходные данные
            </Typography>
            <Calculator2Form
              config={config}
              configError={configError}
              configLoading={configLoading}
              loading={loading}
              onReset={handleReset}
              onSubmit={handleSubmit}
            />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Calculator2Result calculation={calculation} />
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
    </>
  );
}
