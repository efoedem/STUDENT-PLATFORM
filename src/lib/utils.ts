import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a thrown server error into a short, readable sentence. */
export function errMessage(err: unknown, fallback = "Something went wrong") {
  const raw = err instanceof Error ? err.message : fallback;
  return raw.replace(/^Error:\s*/i, "").slice(0, 200) || fallback;
}
