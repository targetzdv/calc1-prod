import type { NextConfig } from "next";

function normalizeBasePath(value: string | undefined): string | undefined {
  if (!value || value === "/") {
    return undefined;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  async rewrites() {
    const defaultApiTarget =
      process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "http://api:8000";
    const apiTarget = process.env.API_PROXY_TARGET || defaultApiTarget;

    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
