/** Parse `?page=` from the URL; invalid or missing values default to 1. */
export function parsePageParam(value: string | undefined): number {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Total pages for a row count (at least 1 so "Page 1 of 1" when empty). */
export function totalPagesForCount(count: number | null | undefined, pageSize: number): number {
  const n = count ?? 0;
  return Math.max(1, Math.ceil(n / pageSize));
}

/** Inclusive 0-based range indices for Supabase `.range(from, to)`. */
export function rangeForPage(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
