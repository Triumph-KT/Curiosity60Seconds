import { redirect } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const supabase = await createSupabaseServerClient();
  const { data: logs, count } = await supabase
    .from("audit_log")
    .select("id,action,table_name,record_id,timestamp", { count: "exact" })
    .order("timestamp", { ascending: false })
    .range(from, to);

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/admin/audit-log?page=${safePage}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Audit log</h1>
        <p className="mt-2 text-muted">Database change history.</p>
      </div>
      <section className="card divide-y divide-border p-4 md:p-6">
        {(logs ?? []).map((log) => (
          <p key={log.id} className="py-3 text-sm leading-relaxed text-foreground first:pt-0 last:pb-0">
            <span className="font-medium text-primary">{log.action}</span> {log.table_name}{" "}
            <span className="text-muted">{log.record_id}</span> @{" "}
            {new Date(log.timestamp).toLocaleString()}
          </p>
        ))}
      </section>
      <PaginationControls basePath="/admin/audit-log" page={safePage} totalPages={totalPages} />
    </div>
  );
}
