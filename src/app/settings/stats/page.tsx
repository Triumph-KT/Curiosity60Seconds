import { requireActiveAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsStatsPage() {
  const user = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const [
    { count: totalPublishedPosts },
    { count: totalFollowers },
    { count: totalFollowing },
    { data: ownedPosts },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "published"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
    supabase.from("posts").select("id").eq("user_id", user.id),
  ]);

  const postIds = (ownedPosts ?? []).map((p) => p.id);
  const { data: viewRows } = postIds.length
    ? await supabase.from("post_views").select("post_id").in("post_id", postIds)
    : { data: [] as Array<{ post_id: string }> };
  const totalPostViews = (viewRows ?? []).length;

  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: profileViewRows } = await supabase
    .from("profile_views")
    .select("viewer_id")
    .eq("profile_user_id", user.id)
    .gte("viewed_at", sinceIso)
    .not("viewer_id", "is", null);
  const uniqueProfileViewers = new Set((profileViewRows ?? []).map((r) => r.viewer_id)).size;

  const stats = [
    ["Total posts published", totalPublishedPosts ?? 0],
    ["Total followers", totalFollowers ?? 0],
    ["Total following", totalFollowing ?? 0],
    ["Total post views across all posts", totalPostViews],
    ["Unique profile viewers this month", uniqueProfileViewers],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Stats</h1>
        <p className="mt-2 text-muted">Read-only account and audience metrics.</p>
      </div>
      <div className="card divide-y divide-border p-2 md:p-4">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-4 first:pt-2 last:pb-2">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
