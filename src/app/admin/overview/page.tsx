import { createSupabaseServiceClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const service = await createSupabaseServiceClient();

  const [
    { count: userCount },
    { count: postCount },
    { count: alertCount },
    { data: recentUsers },
  ] = await Promise.all([
    service.from("users").select("*", { count: "exact", head: true }),
    service.from("posts").select("*", { count: "exact", head: true }),
    service.from("system_alerts").select("*", { count: "exact", head: true }).eq("resolved", false),
    service
      .from("users")
      .select("id,email,name,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="mt-2 text-muted">Platform totals and recent activity.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <p className="text-sm font-medium text-muted">Total users</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{userCount ?? 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-muted">Total posts</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{postCount ?? 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-muted">Unresolved alerts</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{alertCount ?? 0}</p>
        </div>
      </div>
      <section className="card p-6 md:p-8">
        <h2 className="text-lg font-semibold text-foreground">Recent signups</h2>
        <ul className="mt-4 divide-y divide-border text-sm">
          {(recentUsers ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap justify-between gap-2 py-3">
              <span className="text-foreground">
                {u.name ?? "—"} <span className="text-muted">({u.email})</span>
              </span>
              <span className="text-muted">{new Date(u.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {(recentUsers ?? []).length === 0 ? <p className="mt-4 text-sm text-muted">No users yet.</p> : null}
      </section>
    </div>
  );
}
