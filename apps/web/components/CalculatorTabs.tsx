"use client";

import { Tabs, Tab, Box, useMediaQuery, useTheme } from "@mui/material";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";

interface CalculatorTabsProps {
  value: number;
  onChange: (event: React.SyntheticEvent, value: number) => void;
}

export function CalculatorTabs({ value, onChange }: CalculatorTabsProps) {
  const theme = useTheme();
  const useCompactLabels = useMediaQuery(theme.breakpoints.down("sm"));

  const labels = useCompactLabels
    ? {
        calculator1: "Конт-пост",
        calculator2: "Образец",
        calculator3: "Сбор.контейнер",
      }
    : {
        calculator1: "Контейнер на поставку",
        calculator2: "Образец",
        calculator3: "Сборный контейнер",
      };

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={value}
        onChange={onChange}
        variant="fullWidth"
        aria-label="калькуляторы себестоимости"
        sx={{
          "& .MuiTab-root": {
            minHeight: 58,
            textTransform: "none",
            fontSize: { xs: "0.8rem", sm: "0.9rem" },
            lineHeight: 1.15,
          },
        }}
      >
        <Tab
          icon={<Inventory2RoundedIcon fontSize="small" />}
          iconPosition="start"
          label={labels.calculator1}
          value={1}
          wrapped
        />
        <Tab
          icon={<TimelineRoundedIcon fontSize="small" />}
          iconPosition="start"
          label={labels.calculator2}
          value={2}
          wrapped
        />
        <Tab
          icon={<QueryStatsRoundedIcon fontSize="small" />}
          iconPosition="start"
          label={labels.calculator3}
          value={3}
          wrapped
        />
      </Tabs>
    </Box>
  );
}
