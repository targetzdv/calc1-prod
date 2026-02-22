"use client";

import { Alert, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import type { ChinaPortCitiesData } from "@/lib/api";

interface ChinaPortCitiesCardProps {
  data: ChinaPortCitiesData | null;
  loading: boolean;
  error: string | null;
}

export function ChinaPortCitiesCard({ data, loading, error }: ChinaPortCitiesCardProps) {
  const regions = data
    ? Array.from(new Set(data.cities.map((item) => item.district).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      )
    : [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.4 },
        borderRadius: 2.5,
        border: "1px solid rgba(190,210,235,0.24)",
        backgroundColor: "rgba(140,176,232,0.06)",
      }}
    >
      <Typography variant="h6" sx={{ mb: 0.4 }}>
        Города по китайскому порту
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Блок заполняется при нажатии кнопки «Рассчитать» на основе листа Google Sheets `china_port_final`.
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Загружаем города для выбранного порта...
        </Typography>
      ) : null}

      {!loading && error ? (
        <Alert severity="warning">{error}</Alert>
      ) : null}

      {!loading && !error && !data ? (
        <Typography variant="body2" color="text.secondary">
          После расчёта здесь появятся города, связанные с выбранным китайским портом.
        </Typography>
      ) : null}

      {!loading && !error && data ? (
        <Box>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              mb: 1.2,
              alignItems: "center",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Выбранный порт: {data.requested_port}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Найдено городов: {data.total_cities}
            </Typography>
            {regions.length > 0 ? (
              <Typography variant="caption" color="text.secondary">
                Регионы: {regions.join(", ")}
              </Typography>
            ) : null}
          </Box>

          {data.total_cities === 0 ? (
            <Alert severity="info">Для этого порта города не найдены в листе china_port_final.</Alert>
          ) : (
            <TableContainer sx={{ borderRadius: 1.4, border: "1px solid rgba(190,210,235,0.2)" }}>
              <Table size="small" aria-label="Города по китайскому порту">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Регион</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>City (EN)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Город (RU)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.cities.map((item) => (
                    <TableRow key={`${item.city_en}-${item.city_ru}-${item.district}`}>
                      <TableCell>{item.district || "-"}</TableCell>
                      <TableCell>{item.city_en}</TableCell>
                      <TableCell>{item.city_ru}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {data.matched_ports.length > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.1, display: "block" }}>
              Совпадение по столбцу china_port_reg, выбранный порт: {data.matched_ports.join(", ")}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Paper>
  );
}
