"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  TextField,
  Button,
  Alert,
  Autocomplete,
  createFilterOptions,
} from "@mui/material";
import { CONTAINER_SIZES, CITY_PORT_MAP, MATERIALS, PORTS_FROM } from "@/lib/constants";
import { getReferenceData, type ReferenceData } from "@/lib/api";

const isSameValue = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

const normalizeContainer = (container: string): "20ft" | "40ft" | null => {
  const raw = String(container).trim().toLowerCase();

  if (raw.includes("20")) {
    return "20ft";
  }

  if (raw.includes("40")) {
    return "40ft";
  }

  return null;
};

const sortRu = (left: string, right: string) => left.localeCompare(right, "ru");

const sortContainer = (items: string[]) =>
  [...items].sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));

const optionFilter = createFilterOptions<string>({
  ignoreCase: true,
  matchFrom: "any",
  trim: true,
  stringify: (option) => option,
});

interface SearchableSelectFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
  noOptionsText?: string;
}

function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  helperText,
  errorText,
  noOptionsText = "Ничего не найдено",
}: SearchableSelectFieldProps) {
  return (
    <Autocomplete
      options={options}
      value={value || null}
      onChange={(_, nextValue) => onChange(nextValue ?? "")}
      disabled={disabled}
      filterOptions={optionFilter}
      noOptionsText={noOptionsText}
      isOptionEqualToValue={(option, currentValue) => option === currentValue}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={Boolean(errorText)}
          helperText={errorText ?? helperText}
        />
      )}
    />
  );
}

// Zod схема для валидации
export const calculatorFormSchema = z.object({
  city_to: z.string().min(1, "Укажите пункт назначения"),
  railway_station: z.string().optional(),
  container_size: z
    .string()
    .refine(
      (value) => CONTAINER_SIZES.includes(value as (typeof CONTAINER_SIZES)[number]),
      "Выберите размер контейнера",
    ),
  port_from: z.string().min(1, "Укажите порт отправления"),
  material: z.string().min(1, "Укажите материал"),
  quantity: z.number().min(1, "Количество должно быть больше 0").positive("Количество должно быть положительным"),
  price_per_kg: z.number().min(0.01, "Цена должна быть больше 0").positive("Цена должна быть положительной"),
});

export type CalculatorFormData = z.infer<typeof calculatorFormSchema>;

interface FormInputsProps {
  onSubmit: (data: CalculatorFormData) => void;
  loading?: boolean;
  onReset?: () => void;
}

const defaultFormValues: CalculatorFormData = {
  city_to: "",
  railway_station: "",
  container_size: "",
  port_from: "",
  material: "",
  quantity: 0,
  price_per_kg: 0,
};

export function FormInputs({ onSubmit, loading = false, onReset }: FormInputsProps) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    clearErrors,
    formState: { errors },
  } = useForm<CalculatorFormData>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues: defaultFormValues,
  });

  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getReferenceData()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setReferenceData(data);
        setReferenceError(null);
      })
      .catch((error) => {
        console.error("Ошибка загрузки справочников:", error);
        if (cancelled) {
          return;
        }
        setReferenceError("Не удалось загрузить актуальные справочники. Используются локальные данные.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const cityTo = watch("city_to");
  const railwayStation = watch("railway_station");
  const containerSize = watch("container_size");
  const portFrom = watch("port_from");

  const cityPortMap = useMemo<Record<string, string>>(
    () => referenceData?.city_port_map ?? { ...CITY_PORT_MAP },
    [referenceData],
  );

  const cityOptions = useMemo(() => Object.keys(cityPortMap).sort(sortRu), [cityPortMap]);

  const materialOptions = useMemo(() => {
    if (!referenceData?.materials?.length) {
      return [...MATERIALS];
    }

    return Array.from(new Set(referenceData.materials.map((item) => item.material).filter(Boolean)));
  }, [referenceData]);

  const portTo = cityTo ? cityPortMap[cityTo] ?? "" : "";
  const isVladivostokRoute = isSameValue(portTo, "Владивосток");

  const stationOptions = useMemo(() => {
    if (!cityTo || !isVladivostokRoute) {
      return [];
    }

    if (!referenceData) {
      return [];
    }

    const stationsByCity = new Set(
      referenceData.railway_car_delivery
        .filter((item) => isSameValue(item.city, cityTo))
        .map((item) => item.station.trim())
        .filter(Boolean),
    );

    const stationsByPort = new Set(
      referenceData.railway_delivery
        .filter((item) => isSameValue(item.port, portTo))
        .map((item) => item.station.trim())
        .filter(Boolean),
    );

    return Array.from(stationsByCity)
      .filter((station) => stationsByPort.size === 0 || stationsByPort.has(station))
      .sort(sortRu);
  }, [cityTo, isVladivostokRoute, portTo, referenceData]);

  const containerOptions = useMemo(() => {
    if (!cityTo) {
      return [];
    }

    if (!referenceData) {
      return [...CONTAINER_SIZES];
    }

    if (isVladivostokRoute) {
      if (!railwayStation) {
        return [];
      }

      const railContainers = new Set(
        referenceData.railway_delivery
          .filter(
            (item) => isSameValue(item.port, portTo) && isSameValue(item.station, railwayStation),
          )
          .map((item) => normalizeContainer(item.container))
          .filter((item): item is "20ft" | "40ft" => item !== null),
      );

      const railCarContainers = new Set(
        referenceData.railway_car_delivery
          .filter(
            (item) =>
              isSameValue(item.station, railwayStation) && isSameValue(item.city, cityTo),
          )
          .map((item) => normalizeContainer(item.container))
          .filter((item): item is "20ft" | "40ft" => item !== null),
      );

      const intersection = Array.from(railContainers).filter((item) => railCarContainers.has(item));
      const fallbackUnion = Array.from(new Set([...railContainers, ...railCarContainers]));

      return sortContainer(intersection.length > 0 ? intersection : fallbackUnion);
    }

    const carContainers = new Set(
      referenceData.car_delivery
        .filter((item) => isSameValue(item.port, portTo) && isSameValue(item.city, cityTo))
        .map((item) => normalizeContainer(item.container))
        .filter((item): item is "20ft" | "40ft" => item !== null),
    );

    return sortContainer(Array.from(carContainers));
  }, [cityTo, isVladivostokRoute, portTo, railwayStation, referenceData]);

  const portFromOptions = useMemo(() => {
    if (!cityTo || !portTo || !containerSize) {
      return [];
    }

    if (!referenceData) {
      return [...PORTS_FROM];
    }

    return Array.from(
      new Set(
        referenceData.freight
          .filter(
            (item) =>
              isSameValue(item.point_b, portTo) &&
              normalizeContainer(item.container) === containerSize,
          )
          .map((item) => item.point_a.trim())
          .filter(Boolean),
      ),
    ).sort(sortRu);
  }, [cityTo, containerSize, portTo, referenceData]);

  const stationDisabled = !cityTo || !isVladivostokRoute || stationOptions.length === 0;
  const containerDisabled = !cityTo || (isVladivostokRoute && !railwayStation) || containerOptions.length === 0;
  const portFromDisabled = !containerSize || portFromOptions.length === 0;
  const materialDisabled = !portFrom;

  const handleResetClick = () => {
    reset(defaultFormValues);
    onReset?.();
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {referenceError && <Alert severity="warning">{referenceError}</Alert>}

      <Controller
        name="city_to"
        control={control}
        render={({ field }) => (
          <SearchableSelectField
            label="1. Пункт назначения (город)"
            value={field.value}
            options={cityOptions}
            errorText={errors.city_to?.message}
            helperText="Начните с выбора города"
            onChange={(nextValue) => {
              field.onChange(nextValue);
              setValue("railway_station", "");
              setValue("container_size", "");
              setValue("port_from", "");
              clearErrors(["city_to", "railway_station", "container_size", "port_from"]);
            }}
          />
        )}
      />

      <TextField
        label="Порт назначения (автовыбор)"
        value={portTo || "-"}
        fullWidth
        disabled
        helperText={cityTo ? "Порт определяется автоматически по выбранному городу" : "Выберите город"}
      />

      <Controller
        name="railway_station"
        control={control}
        render={({ field }) => (
          <SearchableSelectField
            label="2. ЖД станция"
            value={field.value ?? ""}
            options={stationOptions}
            disabled={stationDisabled}
            errorText={errors.railway_station?.message}
            helperText={
              !cityTo
                ? "Сначала выберите город"
                : !isVladivostokRoute
                  ? "Для этого маршрута станция не требуется"
                  : stationOptions.length === 0
                    ? "Для выбранного города станции не найдены"
                    : "Выберите станцию"
            }
            onChange={(nextValue) => {
              field.onChange(nextValue);
              setValue("container_size", "");
              setValue("port_from", "");
              clearErrors(["railway_station", "container_size", "port_from"]);
            }}
          />
        )}
      />

      <Controller
        name="container_size"
        control={control}
        render={({ field }) => (
          <SearchableSelectField
            label="3. Размер контейнера"
            value={field.value}
            options={containerOptions}
            disabled={containerDisabled}
            errorText={errors.container_size?.message}
            helperText={
              !cityTo
                ? "Сначала выберите город"
                : isVladivostokRoute && !railwayStation
                  ? "Сначала выберите станцию"
                  : containerOptions.length === 0
                    ? "Нет доступных контейнеров для выбранного маршрута"
                    : "Выберите контейнер"
            }
            onChange={(nextValue) => {
              field.onChange(nextValue);
              setValue("port_from", "");
              clearErrors(["container_size", "port_from"]);
            }}
          />
        )}
      />

      <Controller
        name="port_from"
        control={control}
        render={({ field }) => (
          <SearchableSelectField
            label="4. Порт отправления (Китай)"
            value={field.value}
            options={portFromOptions}
            disabled={portFromDisabled}
            errorText={errors.port_from?.message}
            helperText={
              !containerSize
                ? "Сначала выберите контейнер"
                : portFromOptions.length === 0
                  ? "Нет доступных портов отправления для выбранного маршрута"
                  : "Выберите порт отправления"
            }
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="material"
        control={control}
        render={({ field }) => (
          <SearchableSelectField
            label="5. Материал"
            value={field.value}
            options={materialOptions}
            disabled={materialDisabled}
            errorText={errors.material?.message}
            helperText={!portFrom ? "Сначала выберите порт отправления" : "Выберите материал"}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="quantity"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value === 0 ? "" : field.value}
            type="number"
            label="6. Количество"
            fullWidth
            disabled={materialDisabled}
            error={!!errors.quantity}
            helperText={!portFrom ? "Сначала выберите порт отправления" : errors.quantity?.message}
            InputProps={{
              inputProps: { step: 1 },
            }}
            onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          />
        )}
      />

      <Controller
        name="price_per_kg"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value === 0 ? "" : field.value}
            type="number"
            label="7. Цена за кг (CNY)"
            fullWidth
            disabled={materialDisabled}
            error={!!errors.price_per_kg}
            helperText={!portFrom ? "Сначала выберите порт отправления" : errors.price_per_kg?.message}
            InputProps={{
              inputProps: { step: 0.01 },
            }}
            onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          />
        )}
      />

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
