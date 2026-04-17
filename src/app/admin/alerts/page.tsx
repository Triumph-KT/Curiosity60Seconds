import { dismissAlertAction } from "@/app/actions";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export default async function AdminAlertsPage() {
  const service = await createSupabaseServiceClient();
  const { data: alerts } = await service
    .from("system_alerts")
    .select("id,user_id,type,category,message,created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((alerts ?? []).map((a) => a.user_id).filter(Boolean)));
  const { data: alertUsers } = userIds.length
    ? await service.from("users").select("id,email").in("id", userIds)
    : { data: [] };
  const alertEmailByUserId = new Map((alertUsers ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Alerts</h1>
        <p className="mt-2 text-muted">Unresolved system and moderation alerts.</p>
      </div>
      <section className="rounded-xl border border-accent/30 bg-accent/5 p-6">
        {(alerts ?? []).length === 0 ? (
          <p className="text-sm text-muted">No unresolved alerts.</p>
        ) : (
          (alerts ?? []).map((alert) => (
            <div
              key={alert.id}
              className="mb-4 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm last:mb-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  <strong className="text-muted">User:</strong>{" "}
                  {alert.user_id ? (alertEmailByUserId.get(alert.user_id) ?? alert.user_id) : "System"}
                </p>
                <p>
                  <strong className="text-muted">Category:</strong> {alert.category}
                </p>
                <p>
                  <strong className="text-muted">Type:</strong> {alert.type}
                </p>
                <p>
                  <strong className="text-muted">Message:</strong> {alert.message}
                </p>
                <p className="text-xs text-muted">
                  <strong>Time:</strong> {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
              <form action={dismissAlertAction} className="shrink-0">
                <input type="hidden" name="alertId" value={alert.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-foreground hover:bg-surface"
                >
                  Dismiss
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
