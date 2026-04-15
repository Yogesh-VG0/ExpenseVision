const DEFAULT_PRODUCTION_APP_URL = "https://expensevision.tech";
const DEFAULT_DEVELOPMENT_APP_URL = "http://localhost:3000";

function normalizeAppUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAppUrl() {
  const envUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL ?? "");

  if (envUrl) {
    return envUrl;
  }

  return process.env.NODE_ENV === "production"
    ? DEFAULT_PRODUCTION_APP_URL
    : DEFAULT_DEVELOPMENT_APP_URL;
}

export function getAppUrlObject() {
  return new URL(getAppUrl());
}

export function toAbsoluteAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getAppUrl()).toString();
}