import { requireAdminUser } from "@/lib/auth";
import { runDeletionCleanups } from "@/lib/deletion-cleanup";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  const service = await createSupabaseServiceClient();
  await runDeletionCleanups(service);

  const { count } = await service
    .from("system_alerts")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  return (
    <div className="flex flex-col gap-10 md:flex-row">
      <AdminSidebar unresolvedCount={count ?? 0} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
