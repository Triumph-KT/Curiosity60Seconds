import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { followUserAction, getOrCreateConversationAction, unfollowUserAction } from "@/app/actions";
import { PaginationControls } from "@/components/pagination-controls";
import { ProfileViewTracker } from "@/components/profile-view-tracker";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { runDeletionCleanups } from "@/lib/deletion-cleanup";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/seo";

const PAGE_SIZE = 10;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase
    .from("users")
    .select("name,username,bio,photo_url,onboarded,status")
    .eq("username", username)
    .eq("onboarded", true)
    .eq("status", "active")
    .maybeSingle();
  const displayName = user?.name?.trim() || user?.username || username;
  const description = user?.bio?.trim() || `${displayName} on Curiosity60Seconds`;
  const canonical = absoluteUrl(`/u/${username}`);
  return {
    title: `${displayName} on Curiosity60Seconds`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${displayName} on Curiosity60Seconds`,
      description,
      url: canonical,
      type: "profile",
      images: user?.photo_url ? [{ url: user.photo_url }] : undefined,
    },
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const service = await createSupabaseServiceClient();
  await runDeletionCleanups(service);
  const supabase = await createSupabaseServerClient();

  const { data: user } = await supabase
    .from("users")
    .select("id,name,username,bio,photo_url")
    .eq("username", username)
    .eq("onboarded", true)
    .eq("status", "active")
    .maybeSingle();
  if (!user) notFound();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
  ]);

  let isFollowing = false;
  if (authUser && authUser.id !== user.id) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", authUser.id)
      .eq("following_id", user.id)
      .maybeSingle();
    isFollowing = !!followRow;
  }
  let uniqueViewersLast30Days: number | null = null;
  if (authUser && authUser.id === user.id) {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: uniqueRows } = await supabase
      .from("profile_views")
      .select("viewer_id")
      .eq("profile_user_id", user.id)
      .gte("viewed_at", sinceIso)
      .not("viewer_id", "is", null);
    uniqueViewersLast30Days = new Set((uniqueRows ?? []).map((r) => r.viewer_id)).size;
  }

  const displayName = user.name?.trim() || user.username || "Profile";
  const profileInitial = (user.name ?? user.username ?? "?").charAt(0).toUpperCase();

  const { data: posts, count } = await supabase
    .from("posts")
    .select("id,title,slug,published_at", { count: "exact" })
    .eq("user_id", user.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/u/${encodeURIComponent(username)}?page=${safePage}`);
  }

  const basePath = `/u/${user.username}`;

  return (
    <div className="space-y-10">
      <ProfileViewTracker profileUserId={user.id} />
      <div className="card p-8 md:p-10">
        <div className="flex flex-wrap items-start gap-6">
          {user.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photo_url}
              alt={displayName}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {profileInitial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{user.name}</h1>
            {user.username ? <p className="mt-1 text-muted">@{user.username}</p> : null}
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{user.bio}</p>
            <p className="mt-3 text-sm text-muted">
              <span className="font-semibold text-foreground">{followerCount ?? 0}</span> followers ·{" "}
              <span className="font-semibold text-foreground">{followingCount ?? 0}</span> following
            </p>
            {authUser && authUser.id === user.id ? (
              <p className="mt-2 text-sm text-muted">
                Unique profile viewers in last 30 days:{" "}
                <span className="font-semibold text-foreground">{uniqueViewersLast30Days ?? 0}</span>
              </p>
            ) : null}
            {authUser && authUser.id !== user.id ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <form action={isFollowing ? unfollowUserAction : followUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className={isFollowing ? "btn-secondary-sm" : "btn-primary-sm"}
                  >
                    {isFollowing ? "Unfollow" : "Follow"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    const conversationId = await getOrCreateConversationAction(user.id);
                    redirect(`/messages?c=${conversationId}`);
                  }}
                >
                  <button type="submit" className="btn-secondary-sm">
                    Message
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Posts</h2>
        <div className="grid gap-3">
          {(posts ?? []).map((post) => (
            <Link
              key={post.id}
              href={`/u/${user.username}/${post.slug}`}
              className="card block p-5 transition hover:shadow-md"
            >
              <p className="font-semibold text-foreground">{post.title}</p>
              <p className="mt-1 text-sm text-muted">{new Date(post.published_at).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </div>
      <PaginationControls basePath={basePath} page={safePage} totalPages={totalPages} />
    </div>
  );
}
