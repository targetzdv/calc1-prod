"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const normalizeText = (value: string) => value.trim().toLowerCase();

const isSameValue = (left: string, right: string) => normalizeText(left) === normalizeText(right);

const includeSelectedOption = (options: string[], selected: string) => {
  if (!selected) {
    return options;
  }

  return options.some((option) => isSameValue(option, selected)) ? options : [selected, ...options];
};

const getMappedPort = (cityPortMap: Record<string, string>, city: string) => {
  if (!city) {
    return "";
  }

  const exactMatch = cityPortMap[city];
  if (exactMatch) {
    return exactMatch;
  }

  const matchedCity = Object.keys(cityPortMap).find((key) => normalizeText(key) === normalizeText(city));
  return matchedCity ? cityPortMap[matchedCity] ?? "" : "";
};

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
  id: string;
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
  id,
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
      id={id}
      options={options}
      value={value || null}
      onChange={(_, nextValue) => onChange(nextValue ?? "")}
      disabled={disabled}
      filterOptions={optionFilter}
      noOptionsText={noOptionsText}
      isOptionEqualToValue={(option, currentValue) => isSameValue(option, currentValue)}
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
    formState: { errors, isDirty },
  } = useForm<CalculatorFormData>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues: defaultFormValues,
  });

  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    let cancelled = false;

    getReferenceData()
      .then((data) => {
        if (cancelled || isDirtyRef.current) {
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
  const railwayStation = watch("railway_station") ?? "";
  const containerSize = watch("container_size");
  const portFrom = watch("port_from");
  const material = watch("material");

  const cityPortMap = useMemo<Record<string, string>>(
    () => referenceData?.city_port_map ?? { ...CITY_PORT_MAP },
    [referenceData],
  );

  const cityOptions = useMemo(
    () => includeSelectedOption(Object.keys(cityPortMap).sort(sortRu), cityTo),
    [cityPortMap, cityTo],
  );

  const materialOptions = useMemo(() => {
    const options = !referenceData?.materials?.length
      ? [...MATERIALS]
      : Array.from(new Set(referenceData.materials.map((item) => item.material).filter(Boolean)));

    return includeSelectedOption(options, material);
  }, [material, referenceData]);

  const portTo = getMappedPort(cityPortMap, cityTo);
  const isVladivostokRoute = isSameValue(portTo, "Владивосток");

  const stationOptions = useMemo(() => {
    if (!cityTo || !isVladivostokRoute) {
      return includeSelectedOption([], railwayStation);
    }

    if (!referenceData) {
      return includeSelectedOption([], railwayStation);
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

    if (stationsByCity.size === 0) {
      const cityMatchedStations = Array.from(stationsByPort).filter((station) => isSameValue(station, cityTo));
      const fallbackStations = cityMatchedStations.length > 0 ? cityMatchedStations : Array.from(stationsByPort);
      return includeSelectedOption(fallbackStations.sort(sortRu), railwayStation);
    }

    const options = Array.from(stationsByCity)
      .filter((station) => stationsByPort.size === 0 || stationsByPort.has(station))
      .sort(sortRu);

    return includeSelectedOption(options, railwayStation);
  }, [cityTo, isVladivostokRoute, portTo, railwayStation, referenceData]);

  const containerOptions = useMemo(() => {
    if (!cityTo) {
      return includeSelectedOption([], containerSize);
    }

    if (!referenceData) {
      return includeSelectedOption([...CONTAINER_SIZES], containerSize);
    }

    if (isVladivostokRoute) {
      if (!railwayStation) {
        return includeSelectedOption([], containerSize);
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

      return includeSelectedOption(
        sortContainer(intersection.length > 0 ? intersection : fallbackUnion),
        containerSize,
      );
    }

    const carContainers = new Set(
      referenceData.car_delivery
        .filter((item) => isSameValue(item.port, portTo) && isSameValue(item.city, cityTo))
        .map((item) => normalizeContainer(item.container))
        .filter((item): item is "20ft" | "40ft" => item !== null),
    );

    return includeSelectedOption(sortContainer(Array.from(carContainers)), containerSize);
  }, [cityTo, containerSize, isVladivostokRoute, portTo, railwayStation, referenceData]);

  const portFromOptions = useMemo(() => {
    if (!cityTo || !portTo || !containerSize) {
      return includeSelectedOption([], portFrom);
    }

    if (!referenceData) {
      return includeSelectedOption([...PORTS_FROM], portFrom);
    }

    const options = Array.from(
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

    return includeSelectedOption(options, portFrom);
  }, [cityTo, containerSize, portFrom, portTo, referenceData]);

  const stationDisabled = !cityTo || !isVladivostokRoute || stationOptions.length === 0;
  const containerDisabled = !cityTo || (isVladivostokRoute && !railwayStation) || containerOptions.length === 0;
  const portFromDisabled = !containerSize || portFromOptions.length === 0;
  const materialDisabled = !portFrom;

  const handleResetClick = () => {
    reset(defaultFormValues);
    onReset?.();
  };

  const handleCalculateClick = () => {
    void handleSubmit(onSubmit)();
  };

  return (
    <Box
      component="section"
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
            id="field-city-to"
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
        id="field-port-to"
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
            id="field-railway-station"
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
            id="field-container-size"
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
            id="field-port-from"
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
            id="field-material"
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
            id="field-quantity"
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
            id="field-price-per-kg"
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
          type="button"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          onClick={handleCalculateClick}
        >
          {loading ? "Расчёт..." : "Рассчитать"}
        </Button>
      </Box>
    </Box>
  );
}
