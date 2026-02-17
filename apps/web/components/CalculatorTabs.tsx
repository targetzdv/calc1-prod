"use client";

import { Tabs, Tab, Box } from "@mui/material";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";

interface CalculatorTabsProps {
  value: number;
  onChange: (event: React.SyntheticEvent, value: number) => void;
}

export function CalculatorTabs({ value, onChange }: CalculatorTabsProps) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={value}
        onChange={onChange}
        variant="fullWidth"
        aria-label="калькуляторы себестоимости"
      >
        <Tab icon={<Inventory2RoundedIcon fontSize="small" />} iconPosition="start" label="Калькулятор 1" value={1} />
        <Tab icon={<TimelineRoundedIcon fontSize="small" />} iconPosition="start" label="Калькулятор 2" value={2} />
        <Tab icon={<QueryStatsRoundedIcon fontSize="small" />} iconPosition="start" label="Калькулятор 3" value={3} />
      </Tabs>
    </Box>
  );
}
