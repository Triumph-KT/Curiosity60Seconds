import Link from "next/link";

function hrefForPage(
  basePath: string,
  page: number,
  extraSearchParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (extraSearchParams) {
    for (const [key, value] of Object.entries(extraSearchParams)) {
      if (value != null && value !== "") params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function PaginationControls({
  basePath,
  page,
  totalPages,
  extraSearchParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  extraSearchParams?: Record<string, string | undefined>;
}) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-4 border-t border-border pt-6 text-sm"
      aria-label="Pagination"
    >
      {prevDisabled ? (
        <span className="rounded-lg border border-border bg-canvas px-4 py-2 text-muted">Previous</span>
      ) : (
        <Link
          href={hrefForPage(basePath, page - 1, extraSearchParams)}
          className="rounded-lg border border-border bg-surface px-4 py-2 font-medium text-foreground shadow-sm hover:bg-canvas"
        >
          Previous
        </Link>
      )}
      <span className="text-muted">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </span>
      {nextDisabled ? (
        <span className="rounded-lg border border-border bg-canvas px-4 py-2 text-muted">Next</span>
      ) : (
        <Link
          href={hrefForPage(basePath, page + 1, extraSearchParams)}
          className="rounded-lg border border-border bg-surface px-4 py-2 font-medium text-foreground shadow-sm hover:bg-canvas"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
