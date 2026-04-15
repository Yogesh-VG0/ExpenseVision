import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Validate redirect path to prevent open redirect attacks */
export function safeRedirectPath(path: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/dashboard";
  }
  return path;
}

export function buildLoginRedirectPath(targetPath: string) {
  const redirect = safeRedirectPath(targetPath);
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
