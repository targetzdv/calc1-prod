"use client";

import { useState } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { alpha, ThemeProvider, createTheme } from "@mui/material/styles";
import { useServerInsertedHTML } from "next/navigation";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#8eb8ff",
      light: "#b7d2ff",
      dark: "#5f86c7",
      contrastText: "#091221",
    },
    secondary: {
      main: "#aeb9c8",
    },
    background: {
      default: "#070c14",
      paper: "#0d1726",
    },
    text: {
      primary: "#dde3ec",
      secondary: "#aeb9c8",
    },
    divider: "rgba(182, 206, 236, 0.28)",
    success: {
      main: "#6cc69a",
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif',
    h4: {
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (activeTheme) => ({
        body: {
          position: "relative",
          minHeight: "100vh",
          color: activeTheme.palette.text.primary,
          background:
            "linear-gradient(112deg, #4b6388 0%, #2b4162 30%, #142035 52%, #0d1726 72%, #070c14 100%)",
        },
        "body::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 52%, rgba(142,184,255,0.36) 0%, rgba(142,184,255,0.18) 16%, rgba(142,184,255,0.07) 30%, transparent 45%)",
          zIndex: -1,
        },
        "body::after": {
          content: '""',
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 12% 8%, rgba(255,255,255,0.09) 0%, transparent 20%), radial-gradient(circle at 88% 10%, rgba(255,255,255,0.06) 0%, transparent 18%)",
          mixBlendMode: "screen",
          zIndex: -1,
        },
      }),
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#d4e1f6", 0.24)}`,
          background:
            "linear-gradient(168deg, rgba(20, 34, 54, 0.74) 0%, rgba(12, 23, 38, 0.86) 45%, rgba(8, 16, 27, 0.92) 100%)",
          boxShadow: `0 22px 52px ${alpha("#000000", 0.44)}`,
          backdropFilter: "blur(10px)",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          background: "linear-gradient(90deg, #7eb0ff 0%, #9ac1ff 100%)",
          boxShadow: `0 0 16px ${alpha("#8eb8ff", 0.56)}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: "#aab5c7",
          fontWeight: 600,
          minHeight: 52,
          "&.Mui-selected": {
            color: "#e5eefc",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#ffffff", 0.03),
          borderRadius: 14,
          transition: "all 160ms ease",
          "& fieldset": {
            borderColor: alpha("#d4e1f6", 0.28),
          },
          "&:hover fieldset": {
            borderColor: alpha("#9fc4ff", 0.9),
          },
          "&.Mui-focused fieldset": {
            borderColor: "#9fc4ff",
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#9eacc1",
          "&.Mui-focused": {
            color: "#c5d9ff",
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 2,
          color: "#98a7bf",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingTop: 11,
          paddingBottom: 11,
        },
        contained: {
          background: "linear-gradient(120deg, #88b6ff 0%, #9fc3ff 52%, #c1d7ff 100%)",
          color: "#0b1526",
          boxShadow: `0 14px 30px ${alpha("#8eb8ff", 0.4)}`,
          "&:hover": {
            background: "linear-gradient(120deg, #7caeff 0%, #95bdff 52%, #b8d2ff 100%)",
            boxShadow: `0 16px 32px ${alpha("#8eb8ff", 0.46)}`,
          },
          "&.Mui-disabled": {
            color: alpha("#0f1a2c", 0.56),
            background: alpha("#92bbff", 0.4),
          },
        },
        outlined: {
          color: "#d7e5ff",
          borderColor: alpha("#a8c8ff", 0.72),
          backgroundColor: alpha("#8eb8ff", 0.08),
          "&:hover": {
            borderColor: "#9fc4ff",
            backgroundColor: alpha("#8eb8ff", 0.16),
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${alpha("#d4e1f6", 0.2)}`,
          background:
            "linear-gradient(160deg, rgba(18, 32, 51, 0.98) 0%, rgba(9, 17, 29, 0.98) 100%)",
        },
        option: {
          "&[aria-selected='true']": {
            backgroundColor: alpha("#8eb8ff", 0.2),
          },
          "&[aria-selected='true'].Mui-focused": {
            backgroundColor: alpha("#8eb8ff", 0.26),
          },
        },
      },
    },
  },
});

export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const emotionCache = createCache({ key: "mui" });
    emotionCache.compat = true;

    const previousInsert = emotionCache.insert;
    let inserted: string[] = [];

    emotionCache.insert = (...args: Parameters<typeof previousInsert>) => {
      const serialized = args[1] as { name: string };

      if (emotionCache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }

      return previousInsert(...args);
    };

    const flushInserted = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };

    return { cache: emotionCache, flush: flushInserted };
  });

  useServerInsertedHTML(() => {
    const insertedNames = flush();

    if (insertedNames.length === 0) {
      return null;
    }

    let styles = "";
    for (const name of insertedNames) {
      styles += cache.inserted[name];
    }

    return (
      <style
        data-emotion={`${cache.key} ${insertedNames.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </CacheProvider>
  );
}
