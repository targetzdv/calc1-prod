"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";

import type { Calculator2Config } from "@/lib/api";
import {
  calculator2DefaultValues,
  calculator2Schema,
  type Calculator2FormData,
} from "./calculator2.schema";

interface Calculator2FormProps {
  config: Calculator2Config | null;
  configError?: string | null;
  configLoading?: boolean;
  loading?: boolean;
  onReset?: () => void;
  onSubmit: (data: Calculator2FormData) => void;
}

const formatRateDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  }

  return value;
};

export function Calculator2Form({
  config,
  configError,
  configLoading = false,
  loading = false,
  onReset,
  onSubmit,
}: Calculator2FormProps) {
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { dirtyFields, errors },
  } = useForm<Calculator2FormData>({
    resolver: zodResolver(calculator2Schema),
    defaultValues: calculator2DefaultValues,
  });

  useEffect(() => {
    if (!config?.exchange_rate_cny_to_rub_adjusted) {
      return;
    }

    if (dirtyFields.exchange_rate_cny_to_rub_adjusted) {
      return;
    }

    const currentValue = getValues("exchange_rate_cny_to_rub_adjusted");
    if (currentValue > 0) {
      return;
    }

    setValue(
      "exchange_rate_cny_to_rub_adjusted",
      config.exchange_rate_cny_to_rub_adjusted,
      { shouldDirty: false, shouldTouch: false, shouldValidate: false },
    );
  }, [
    config?.exchange_rate_cny_to_rub_adjusted,
    dirtyFields.exchange_rate_cny_to_rub_adjusted,
    getValues,
    setValue,
  ]);

  const handleResetClick = () => {
    reset({
      ...calculator2DefaultValues,
      exchange_rate_cny_to_rub_adjusted: config?.exchange_rate_cny_to_rub_adjusted ?? 0,
    });
    onReset?.();
  };

  const rateDateLabel = formatRateDate(config?.currency_rate_date);
  const rateHint = rateDateLabel
    ? `Курс актуален на ${rateDateLabel}. Автоподстановка = курс ЦБ РФ + 5%`
    : "Автоподстановка = курс ЦБ РФ + 5%. Если курс не загрузился, введите его вручную.";

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 3 }}
    >
      {configError ? <Alert severity="warning">{configError}</Alert> : null}

      <Controller
        name="purchase_price_cny_per_kg"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value === 0 ? "" : field.value}
            type="number"
            label="1. Закупка в КНР, CNY/кг"
            fullWidth
            error={Boolean(errors.purchase_price_cny_per_kg)}
            helperText={errors.purchase_price_cny_per_kg?.message}
            InputProps={{
              inputProps: { step: 0.01, min: 0 },
            }}
            onChange={(event) =>
              field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
            }
          />
        )}
      />

      <Controller
        name="weight_kg"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value === 0 ? "" : field.value}
            type="number"
            label="2. Вес, кг"
            fullWidth
            error={Boolean(errors.weight_kg)}
            helperText={errors.weight_kg?.message}
            InputProps={{
              inputProps: { step: 0.01, min: 0, max: 100 },
            }}
            onChange={(event) =>
              field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
            }
          />
        )}
      />

      <Controller
        name="exchange_rate_cny_to_rub_adjusted"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value === 0 ? "" : field.value}
            type="number"
            label="3. Курс CNY→RUB"
            fullWidth
            error={Boolean(errors.exchange_rate_cny_to_rub_adjusted)}
            helperText={
              errors.exchange_rate_cny_to_rub_adjusted?.message
              ?? (configLoading
                ? "Пытаемся подставить курс автоматически"
                : "Курс можно скорректировать вручную только для текущего расчёта")
            }
            InputProps={{
              inputProps: { step: 0.0001, min: 0 },
            }}
            onChange={(event) =>
              field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
            }
          />
        )}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mt: -1.8 }}>
        {rateHint}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button
          type="button"
          variant="outlined"
          fullWidth
          size="large"
          disabled={loading}
          onClick={handleResetClick}
        >
          Сбросить
        </Button>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
        >
          {loading ? "Расчёт..." : "Рассчитать"}
        </Button>
      </Box>
    </Box>
  );
}
