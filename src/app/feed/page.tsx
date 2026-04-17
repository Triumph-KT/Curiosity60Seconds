import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { estimateReadTimeLabel, getPostRankScore } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";
import { stripMarkdownForPreview } from "@/lib/markdown-preview";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "Feed — Curiosity60Seconds",
  description: "Latest posts from the Curiosity60Seconds community",
  alternates: {
    canonical: absoluteUrl("/feed"),
  },
  openGraph: {
    title: "Feed — Curiosity60Seconds",
    description: "Latest posts from the Curiosity60Seconds community",
    url: absoluteUrl("/feed"),
    type: "website",
  },
};

type FeedTimelineRow = {
  item_kind: string;
  sort_at: string;
  repost_id: string | null;
  reposter_id: string | null;
  reposter_name: string | null;
  reposter_username: string | null;
  reposter_photo_url: string | null;
  post_id: string;
  post_title: string;
  post_slug: string;
  post_body_md: string;
  post_published_at: string;
  author_name: string | null;
  author_username: string | null;
  author_photo_url: string | null;
  author_id: string;
};

function formatPublishedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatRepostTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function feedPath(page: number, view: "everyone" | "following", sort: "latest" | "relevance") {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (view === "following") params.set("view", "following");
  if (sort === "relevance") params.set("sort", "relevance");
  const qs = params.toString();
  return qs ? `/feed?${qs}` : "/feed";
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const view = sp.view === "following" ? "following" : "everyone";
  const sort = sp.sort === "relevance" ? "relevance" : "latest";
  const { from } = rangeForPage(page, PAGE_SIZE);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let timelineRows: FeedTimelineRow[] = [];
  let count: number | null = null;
  let followingNobody = false;
  let needsLoginForFollowing = false;

  if (view === "following") {
    if (!authUser?.id) {
      needsLoginForFollowing = true;
    } else {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", authUser.id);

      const followingIds = (followRows ?? []).map((r) => r.following_id).filter(Boolean);

      if (followingIds.length === 0) {
        followingNobody = true;
      } else {
        const [{ data: rows }, { data: countData }] = await Promise.all([
          supabase.rpc("feed_timeline", {
            p_viewer: authUser.id,
            p_mode: "following",
            p_limit: sort === "relevance" ? 200 : PAGE_SIZE,
            p_offset: sort === "relevance" ? 0 : from,
          }),
          supabase.rpc("feed_timeline_count", {
            p_viewer: authUser.id,
            p_mode: "following",
          }),
        ]);
        timelineRows = (rows ?? []) as FeedTimelineRow[];
        count = Number(countData ?? 0);
      }
    }
  } else {
    const [{ data: rows }, { data: countData }] = await Promise.all([
      supabase.rpc("feed_timeline", {
        p_viewer: authUser?.id ?? null,
        p_mode: "everyone",
        p_limit: sort === "relevance" ? 200 : PAGE_SIZE,
        p_offset: sort === "relevance" ? 0 : from,
      }),
      supabase.rpc("feed_timeline_count", {
        p_viewer: authUser?.id ?? null,
        p_mode: "everyone",
      }),
    ]);
    timelineRows = (rows ?? []) as FeedTimelineRow[];
    count = Number(countData ?? 0);
  }

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(feedPath(safePage, view, sort));
  }

  const feedExtraParams =
    ({
      ...(view === "following" ? { view: "following" } : {}),
      ...(sort === "relevance" ? { sort: "relevance" } : {}),
    } as Record<string, string>);
  const postIds = Array.from(new Set(timelineRows.map((r) => r.post_id)));
  const [
    { data: reactionRows },
    { data: commentRows },
    { data: viewRows },
    { data: durationRows },
    { data: repostRows },
  ] = await Promise.all([
    postIds.length
      ? supabase.from("reactions").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    postIds.length
      ? supabase.from("comments").select("post_id").in("post_id", postIds).eq("deleted", false)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    postIds.length
      ? supabase.from("post_views").select("post_id,viewer_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string; viewer_id: string | null }> }),
    postIds.length
      ? supabase
          .from("post_views")
          .select("post_id,duration_seconds")
          .in("post_id", postIds)
          .not("duration_seconds", "is", null)
      : Promise.resolve({ data: [] as Array<{ post_id: string; duration_seconds: number | null }> }),
    postIds.length
      ? supabase.from("reposts").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
  ]);
  const reactionCountByPost = new Map<string, number>();
  for (const row of reactionRows ?? []) {
    reactionCountByPost.set(row.post_id, (reactionCountByPost.get(row.post_id) ?? 0) + 1);
  }
  const commentCountByPost = new Map<string, number>();
  for (const row of commentRows ?? []) {
    commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1);
  }
  const totalViewsByPost = new Map<string, number>();
  const uniqueViewersByPost = new Map<string, Set<string>>();
  for (const row of viewRows ?? []) {
    totalViewsByPost.set(row.post_id, (totalViewsByPost.get(row.post_id) ?? 0) + 1);
    if (row.viewer_id) {
      const set = uniqueViewersByPost.get(row.post_id) ?? new Set<string>();
      set.add(row.viewer_id);
      uniqueViewersByPost.set(row.post_id, set);
    }
  }
  const avgDurationByPost = new Map<string, number>();
  const durationAccumulator = new Map<string, { sum: number; count: number }>();
  for (const row of durationRows ?? []) {
    const cur = durationAccumulator.get(row.post_id) ?? { sum: 0, count: 0 };
    cur.sum += row.duration_seconds ?? 0;
    cur.count += 1;
    durationAccumulator.set(row.post_id, cur);
  }
  for (const [postId, v] of durationAccumulator.entries()) {
    avgDurationByPost.set(postId, v.count > 0 ? v.sum / v.count : 0);
  }
  const repostCountByPost = new Map<string, number>();
  for (const row of repostRows ?? []) {
    repostCountByPost.set(row.post_id, (repostCountByPost.get(row.post_id) ?? 0) + 1);
  }
  if (sort === "relevance") {
    timelineRows = [...timelineRows]
      .sort((a, b) => {
        const scoreA = getPostRankScore({
          publishedAt: a.post_published_at,
          totalViews: totalViewsByPost.get(a.post_id) ?? 0,
          uniqueViewers: uniqueViewersByPost.get(a.post_id)?.size ?? 0,
          avgDurationSeconds: avgDurationByPost.get(a.post_id) ?? 0,
          reactionCount: reactionCountByPost.get(a.post_id) ?? 0,
          commentCount: commentCountByPost.get(a.post_id) ?? 0,
          repostCount: repostCountByPost.get(a.post_id) ?? 0,
        });
        const scoreB = getPostRankScore({
          publishedAt: b.post_published_at,
          totalViews: totalViewsByPost.get(b.post_id) ?? 0,
          uniqueViewers: uniqueViewersByPost.get(b.post_id)?.size ?? 0,
          avgDurationSeconds: avgDurationByPost.get(b.post_id) ?? 0,
          reactionCount: reactionCountByPost.get(b.post_id) ?? 0,
          commentCount: commentCountByPost.get(b.post_id) ?? 0,
          repostCount: repostCountByPost.get(b.post_id) ?? 0,
        });
        return scoreB - scoreA;
      })
      .slice(from, from + PAGE_SIZE);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Feed</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={feedPath(view === "everyone" ? safePage : 1, "everyone", sort)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              view === "everyone"
                ? "bg-primary text-white"
                : "border border-border bg-surface text-foreground hover:bg-canvas"
            }`}
          >
            Everyone
          </Link>
          <Link
            href={feedPath(view === "following" ? safePage : 1, "following", sort)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              view === "following"
                ? "bg-primary text-white"
                : "border border-border bg-surface text-foreground hover:bg-canvas"
            }`}
          >
            Following
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={feedPath(1, view, "latest")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              sort === "latest"
                ? "bg-primary text-white"
                : "border border-border bg-surface text-foreground hover:bg-canvas"
            }`}
          >
            Latest
          </Link>
          <Link
            href={feedPath(1, view, "relevance")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              sort === "relevance"
                ? "bg-primary text-white"
                : "border border-border bg-surface text-foreground hover:bg-canvas"
            }`}
          >
            Relevance
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-muted">
          {view === "everyone" ? (
            <>
              Recent posts and reposts from the community
              {authUser ? " — excluding your own" : ""}.
            </>
          ) : (
            <>Posts and reposts from people you follow.</>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {needsLoginForFollowing ? (
          <div className="card space-y-4 p-10 text-center">
            <p className="text-muted">Sign in to see posts from people you follow.</p>
            <Link href="/login" className="btn-primary inline-flex">
              Log in
            </Link>
          </div>
        ) : followingNobody ? (
          <div className="card p-10 text-center text-muted">
            You are not following anyone yet.{" "}
            <Link href="/people" className="font-medium text-primary underline hover:text-primary-hover">
              Explore people
            </Link>{" "}
            to find someone to follow.
          </div>
        ) : timelineRows.length === 0 ? (
          <div className="card p-10 text-center text-muted">No posts to show yet.</div>
        ) : (
          timelineRows.map((row) => {
            const isRepost = row.item_kind === "repost";
            const displayName =
              row.author_name?.trim() || row.author_username || "Author";
            const initial = (row.author_name?.trim() || row.author_username || "?")
              .charAt(0)
              .toUpperCase();
            const profileHref = row.author_username ? `/u/${row.author_username}` : null;
            const postHref =
              row.author_username ? `/u/${row.author_username}/${row.post_slug}` : "#";
            const snippet = stripMarkdownForPreview(row.post_body_md ?? "", 150);
            const reposterDisplay =
              row.reposter_name?.trim() || row.reposter_username || "Someone";
            const reposterHref = row.reposter_username ? `/u/${row.reposter_username}` : null;
            const reactionCount = reactionCountByPost.get(row.post_id) ?? 0;
            const commentCount = commentCountByPost.get(row.post_id) ?? 0;
            const readTimeLabel = estimateReadTimeLabel(row.post_body_md ?? "");

            return (
              <article
                key={
                  isRepost && row.repost_id
                    ? `repost-${row.repost_id}`
                    : `post-${row.post_id}`
                }
                className="card overflow-hidden border-l-4 border-l-accent p-6 shadow-sm md:p-8"
              >
                {isRepost ? (
                  <p className="mb-4 text-sm text-muted">
                    {reposterHref ? (
                      <Link
                        href={reposterHref}
                        className="font-semibold text-primary hover:underline"
                      >
                        {reposterDisplay}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{reposterDisplay}</span>
                    )}{" "}
                    reposted this · {formatRepostTime(row.sort_at)}
                  </p>
                ) : null}
                <div className="flex gap-4">
                  {profileHref ? (
                    <Link href={profileHref} className="shrink-0 self-start">
                      {row.author_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.author_photo_url}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                          {initial}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="shrink-0 self-start">
                      {row.author_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.author_photo_url}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                          {initial}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{displayName}</span>
                      )}
                      <span className="text-sm text-muted">
                        · {formatPublishedDate(row.post_published_at)}
                      </span>
                    </div>
                    {postHref !== "#" ? (
                      <h2 className="mt-2 text-lg font-bold leading-snug text-foreground md:text-xl">
                        <Link href={postHref} className="hover:text-primary hover:underline">
                          {row.post_title}
                        </Link>
                      </h2>
                    ) : (
                      <h2 className="mt-2 text-lg font-bold text-foreground md:text-xl">
                        {row.post_title}
                      </h2>
                    )}
                    <p className="mt-3 leading-relaxed text-muted">{snippet}</p>
                    <p className="mt-3 text-xs text-muted">
                      <span>❤️ {reactionCount}</span>
                      <span className="mx-2">·</span>
                      <span>💬 {commentCount}</span>
                      <span className="mx-2">·</span>
                      <span>{readTimeLabel}</span>
                    </p>
                    {postHref !== "#" ? (
                      <Link
                        href={postHref}
                        className="mt-4 inline-flex text-sm font-semibold text-accent hover:text-accent-hover hover:underline"
                      >
                        Read more
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {timelineRows.length > 0 ? (
        <PaginationControls
          basePath="/feed"
          page={safePage}
          totalPages={totalPages}
          extraSearchParams={feedExtraParams}
        />
      ) : null}
    </div>
  );
}
