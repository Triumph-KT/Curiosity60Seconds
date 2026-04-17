import { requireAdminUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  AnalyticsCharts,
  type GrowthPoint,
  type WeeklyEngagementPoint,
  type WeeklyUserPostsPoint,
} from "./analytics-charts";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d);
  }
  return days;
}

function fmt(num: number) {
  return new Intl.NumberFormat().format(num);
}

function startOfWeekUtc(d: Date) {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  const day = copy.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diffToMonday);
  return copy;
}

function weekLabel(date: Date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export default async function AdminAnalyticsPage() {
  await requireAdminUser();
  const service = await createSupabaseServiceClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const weekIso = sevenDaysAgo.toISOString();
  const thirtyDays = lastNDays(30);
  const thirtyDaysAgoIso = thirtyDays[0].toISOString();
  const currentWeekStart = startOfWeekUtc(now);
  const eightWeeksStart = new Date(currentWeekStart);
  eightWeeksStart.setUTCDate(eightWeeksStart.getUTCDate() - 7 * 7);
  const fourWeeksStart = new Date(currentWeekStart);
  fourWeeksStart.setUTCDate(fourWeeksStart.getUTCDate() - 3 * 7);
  const eightWeeksStartIso = eightWeeksStart.toISOString();
  const fourWeeksStartIso = fourWeeksStart.toISOString();

  const [
    { count: totalUsers },
    { count: indexedProfileUsers },
    { count: totalPosts },
    { count: totalMessages },
    { count: totalReactions },
    { count: totalComments },
    { count: totalFollows },
    { count: newSignups7d },
    { count: newPosts7d },
    { data: usersCreated },
    { data: postsPublishedRows },
    { data: weekViews },
    { data: allPostViews },
    { data: allPublishedPosts },
    { data: allReactions },
    { data: allComments },
    { data: posts8w },
    { data: reactions8w },
    { data: comments8w },
    { data: reposts8w },
    { data: messages30d },
    { data: views30dTime },
    { data: users4w },
    { data: posts4wByUser },
    { data: reactions4wByUser },
  ] = await Promise.all([
    service.from("users").select("*", { count: "exact", head: true }),
    service.from("users").select("*", { count: "exact", head: true }).eq("onboarded", true).eq("status", "active"),
    service.from("posts").select("*", { count: "exact", head: true }),
    service.from("messages").select("*", { count: "exact", head: true }),
    service.from("reactions").select("*", { count: "exact", head: true }),
    service.from("comments").select("*", { count: "exact", head: true }).eq("deleted", false),
    service.from("follows").select("*", { count: "exact", head: true }),
    service.from("users").select("*", { count: "exact", head: true }).gte("created_at", weekIso),
    service
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", weekIso),
    service.from("users").select("id,created_at").gte("created_at", thirtyDaysAgoIso),
    service
      .from("posts")
      .select("id,user_id,published_at,status,title,slug,body_md")
      .eq("status", "published")
      .gte("published_at", thirtyDaysAgoIso),
    service.from("post_views").select("post_id,viewed_at").gte("viewed_at", weekIso),
    service.from("post_views").select("post_id,duration_seconds"),
    service.from("posts").select("id,user_id,title,slug,status,body_md").eq("status", "published"),
    service.from("reactions").select("post_id"),
    service.from("comments").select("post_id").eq("deleted", false),
    service
      .from("posts")
      .select("id,user_id,published_at,status")
      .eq("status", "published")
      .gte("published_at", eightWeeksStartIso),
    service.from("reactions").select("user_id,created_at").gte("created_at", eightWeeksStartIso),
    service.from("comments").select("user_id,created_at").eq("deleted", false).gte("created_at", eightWeeksStartIso),
    service.from("reposts").select("created_at").gte("created_at", eightWeeksStartIso),
    service.from("messages").select("created_at").gte("created_at", thirtyDaysAgoIso),
    service.from("post_views").select("viewed_at").gte("viewed_at", thirtyDaysAgoIso),
    service.from("users").select("id,created_at").gte("created_at", fourWeeksStartIso),
    service
      .from("posts")
      .select("user_id,published_at,status")
      .eq("status", "published")
      .gte("published_at", fourWeeksStartIso),
    service.from("reactions").select("user_id,created_at").gte("created_at", fourWeeksStartIso),
  ]);

  const totalPublishedPosts = (allPublishedPosts ?? []).length;
  const totalPostViews = (allPostViews ?? []).length;
  const durations = (allPostViews ?? [])
    .map((v) => v.duration_seconds)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
  const avgReadTimeSeconds =
    durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

  const reactionCountByPost = new Map<string, number>();
  for (const r of allReactions ?? []) {
    reactionCountByPost.set(r.post_id, (reactionCountByPost.get(r.post_id) ?? 0) + 1);
  }
  const commentCountByPost = new Map<string, number>();
  for (const c of allComments ?? []) {
    commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
  }
  const viewCountByPost = new Map<string, number>();
  for (const v of allPostViews ?? []) {
    viewCountByPost.set(v.post_id, (viewCountByPost.get(v.post_id) ?? 0) + 1);
  }

  const growthBase = new Map<string, number>();
  for (const day of thirtyDays) {
    growthBase.set(dayKey(day), 0);
  }
  for (const u of usersCreated ?? []) {
    const k = u.created_at.slice(0, 10);
    if (growthBase.has(k)) growthBase.set(k, (growthBase.get(k) ?? 0) + 1);
  }
  let cumulative = 0;
  const userGrowth: GrowthPoint[] = Array.from(growthBase.entries()).map(([date, count]) => {
    cumulative += count;
    return { date: date.slice(5), value: cumulative };
  });

  const postActivityBase = new Map<string, number>();
  for (const day of thirtyDays) {
    postActivityBase.set(dayKey(day), 0);
  }
  for (const p of postsPublishedRows ?? []) {
    if (!p.published_at) continue;
    const k = p.published_at.slice(0, 10);
    if (postActivityBase.has(k)) postActivityBase.set(k, (postActivityBase.get(k) ?? 0) + 1);
  }
  const postActivity: GrowthPoint[] = Array.from(postActivityBase.entries()).map(([date, count]) => ({
    date: date.slice(5),
    value: count,
  }));

  const weekStarts: Date[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weekStarts.push(d);
  }
  const weekKeys = weekStarts.map((d) => dayKey(d));
  const weekLabelByKey = new Map(weekStarts.map((d) => [dayKey(d), weekLabel(d)]));

  const postsByUserAllTime = new Map<string, number>();
  for (const p of allPublishedPosts ?? []) {
    postsByUserAllTime.set(p.user_id, (postsByUserAllTime.get(p.user_id) ?? 0) + 1);
  }
  const top5PublisherIds = Array.from(postsByUserAllTime.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid]) => uid);
  const { data: top5Users } = top5PublisherIds.length
    ? await service.from("users").select("id,name,username").in("id", top5PublisherIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const top5UserById = new Map((top5Users ?? []).map((u) => [u.id, u]));
  const userLabelById = new Map(
    top5PublisherIds.map((id) => [id, top5UserById.get(id)?.username || top5UserById.get(id)?.name || id.slice(0, 8)]),
  );
  const topUserSeriesKeys = top5PublisherIds.map((id) => userLabelById.get(id) ?? id.slice(0, 8));

  const postsPerUserPerWeekMap = new Map<string, Map<string, number>>();
  for (const wk of weekKeys) postsPerUserPerWeekMap.set(wk, new Map());
  for (const row of posts8w ?? []) {
    if (!row.published_at || !top5PublisherIds.includes(row.user_id)) continue;
    const wk = dayKey(startOfWeekUtc(new Date(row.published_at)));
    if (!postsPerUserPerWeekMap.has(wk)) continue;
    const label = userLabelById.get(row.user_id) ?? row.user_id.slice(0, 8);
    const bucket = postsPerUserPerWeekMap.get(wk)!;
    bucket.set(label, (bucket.get(label) ?? 0) + 1);
  }
  const postsPerUserWeekly: WeeklyUserPostsPoint[] = weekKeys.map((wk) => {
    const row: WeeklyUserPostsPoint = { week: weekLabelByKey.get(wk) ?? wk.slice(5) };
    const bucket = postsPerUserPerWeekMap.get(wk) ?? new Map();
    for (const key of topUserSeriesKeys) {
      row[key] = bucket.get(key) ?? 0;
    }
    return row;
  });

  const weeklyEngagementBase = new Map<string, WeeklyEngagementPoint>();
  for (const wk of weekKeys) {
    weeklyEngagementBase.set(wk, {
      week: weekLabelByKey.get(wk) ?? wk.slice(5),
      reactions: 0,
      comments: 0,
      reposts: 0,
    });
  }
  for (const r of reactions8w ?? []) {
    const wk = dayKey(startOfWeekUtc(new Date(r.created_at)));
    const bucket = weeklyEngagementBase.get(wk);
    if (bucket) bucket.reactions += 1;
  }
  for (const c of comments8w ?? []) {
    const wk = dayKey(startOfWeekUtc(new Date(c.created_at)));
    const bucket = weeklyEngagementBase.get(wk);
    if (bucket) bucket.comments += 1;
  }
  for (const r of reposts8w ?? []) {
    const wk = dayKey(startOfWeekUtc(new Date(r.created_at)));
    const bucket = weeklyEngagementBase.get(wk);
    if (bucket) bucket.reposts += 1;
  }
  const weeklyEngagement = weekKeys.map((wk) => weeklyEngagementBase.get(wk)!);

  const messageVolumeBase = new Map<string, number>();
  for (const day of thirtyDays) messageVolumeBase.set(dayKey(day), 0);
  for (const m of messages30d ?? []) {
    const k = m.created_at.slice(0, 10);
    if (messageVolumeBase.has(k)) messageVolumeBase.set(k, (messageVolumeBase.get(k) ?? 0) + 1);
  }
  const messageVolume: GrowthPoint[] = Array.from(messageVolumeBase.entries()).map(([date, value]) => ({
    date: date.slice(5),
    value,
  }));

  const weeklyViewsByPost = new Map<string, number>();
  for (const row of weekViews ?? []) {
    weeklyViewsByPost.set(row.post_id, (weeklyViewsByPost.get(row.post_id) ?? 0) + 1);
  }
  const topPostsRaw = (allPublishedPosts ?? [])
    .map((p) => ({
      post: p,
      viewCount: weeklyViewsByPost.get(p.id) ?? 0,
      reactionCount: reactionCountByPost.get(p.id) ?? 0,
      commentCount: commentCountByPost.get(p.id) ?? 0,
    }))
    .filter((x) => x.viewCount > 0)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  const authorIds = Array.from(new Set(topPostsRaw.map((x) => x.post.user_id)));
  const { data: topPostAuthors } = authorIds.length
    ? await service.from("users").select("id,name,username").in("id", authorIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const authorById = new Map((topPostAuthors ?? []).map((a) => [a.id, a]));

  const postsPerUserMap = new Map<string, { postCount: number; totalViews: number }>();
  for (const p of allPublishedPosts ?? []) {
    const current = postsPerUserMap.get(p.user_id) ?? { postCount: 0, totalViews: 0 };
    current.postCount += 1;
    current.totalViews += viewCountByPost.get(p.id) ?? 0;
    postsPerUserMap.set(p.user_id, current);
  }
  const topPublishersIds = Array.from(postsPerUserMap.entries())
    .sort((a, b) => b[1].postCount - a[1].postCount)
    .slice(0, 10)
    .map(([userId]) => userId);
  const { data: topPublishersUsers } = topPublishersIds.length
    ? await service.from("users").select("id,name,username").in("id", topPublishersIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const publisherUserById = new Map((topPublishersUsers ?? []).map((u) => [u.id, u]));
  const topPublishers = topPublishersIds.map((id) => ({
    id,
    name: publisherUserById.get(id)?.name ?? "Unknown",
    username: publisherUserById.get(id)?.username ?? null,
    postCount: postsPerUserMap.get(id)?.postCount ?? 0,
    totalViews: postsPerUserMap.get(id)?.totalViews ?? 0,
  }));

  const avgReactionsPerPost = totalPublishedPosts > 0 ? (totalReactions ?? 0) / totalPublishedPosts : 0;
  const avgCommentsPerPost = totalPublishedPosts > 0 ? (totalComments ?? 0) / totalPublishedPosts : 0;
  const avgViewsPerPost = totalPublishedPosts > 0 ? totalPostViews / totalPublishedPosts : 0;
  const totalIndexedPages = totalPublishedPosts + (indexedProfileUsers ?? 0);

  const topPostsAllTimeRaw = (allPublishedPosts ?? [])
    .map((p) => ({
      post: p,
      viewCount: viewCountByPost.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);
  const topAllTimeAuthorIds = Array.from(new Set(topPostsAllTimeRaw.map((x) => x.post.user_id)));
  const { data: topAllTimeAuthors } = topAllTimeAuthorIds.length
    ? await service.from("users").select("id,name,username").in("id", topAllTimeAuthorIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const topAllTimeAuthorById = new Map((topAllTimeAuthors ?? []).map((a) => [a.id, a]));

  const zeroViewPostsAll = (allPublishedPosts ?? []).filter((p) => (viewCountByPost.get(p.id) ?? 0) === 0);
  const zeroViewPosts = zeroViewPostsAll.slice(0, 20);

  const ageBuckets = {
    less7: { label: "< 7 days", totalViews: 0, posts: 0 },
    between7and30: { label: "7-30 days", totalViews: 0, posts: 0 },
    over30: { label: "> 30 days", totalViews: 0, posts: 0 },
  };
  for (const p of allPublishedPosts ?? []) {
    const publishedAt = postsPublishedRows?.find((x) => x.id === p.id)?.published_at;
    if (!publishedAt) continue;
    const ageDays = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    const views = viewCountByPost.get(p.id) ?? 0;
    if (ageDays < 7) {
      ageBuckets.less7.posts += 1;
      ageBuckets.less7.totalViews += views;
    } else if (ageDays <= 30) {
      ageBuckets.between7and30.posts += 1;
      ageBuckets.between7and30.totalViews += views;
    } else {
      ageBuckets.over30.posts += 1;
      ageBuckets.over30.totalViews += views;
    }
  }
  const avgViewsByAge = Object.values(ageBuckets).map((b) => ({
    label: b.label,
    avgViews: b.posts > 0 ? b.totalViews / b.posts : 0,
    posts: b.posts,
  }));

  const STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "of",
    "in",
    "on",
    "with",
    "by",
    "from",
    "at",
    "is",
    "are",
    "how",
    "what",
    "why",
  ]);
  const titleWordCounts = new Map<string, number>();
  for (const p of allPublishedPosts ?? []) {
    const words = p.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length >= 3 && !STOP_WORDS.has(w));
    for (const w of words) {
      titleWordCounts.set(w, (titleWordCounts.get(w) ?? 0) + 1);
    }
  }
  const commonTitleWords = Array.from(titleWordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const cohortWeekStarts: Date[] = [];
  for (let i = 3; i >= 0; i -= 1) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    cohortWeekStarts.push(d);
  }
  const retentionRows = cohortWeekStarts.map((wkStart) => {
    const wkEnd = new Date(wkStart);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 7);
    const signups = (users4w ?? []).filter((u) => {
      const created = new Date(u.created_at).getTime();
      return created >= wkStart.getTime() && created < wkEnd.getTime();
    });
    const cohortIds = new Set(signups.map((u) => u.id));
    const activeAfter = new Set<string>();
    for (const p of posts4wByUser ?? []) {
      if (!p.published_at) continue;
      const ts = new Date(p.published_at).getTime();
      if (ts <= wkEnd.getTime()) continue;
      if (cohortIds.has(p.user_id)) activeAfter.add(p.user_id);
    }
    for (const r of reactions4wByUser ?? []) {
      const ts = new Date(r.created_at).getTime();
      if (ts <= wkEnd.getTime()) continue;
      if (cohortIds.has(r.user_id)) activeAfter.add(r.user_id);
    }
    return {
      week: weekLabel(wkStart),
      signups: signups.length,
      returned: activeAfter.size,
      retentionPct: signups.length > 0 ? (activeAfter.size / signups.length) * 100 : 0,
    };
  });

  const activityByDowHour = new Map<string, number>();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const addActivity = (iso: string) => {
    const d = new Date(iso);
    const dow = dayNames[d.getUTCDay()];
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const key = `${dow} ${hour}:00`;
    activityByDowHour.set(key, (activityByDowHour.get(key) ?? 0) + 1);
  };
  for (const v of views30dTime ?? []) addActivity(v.viewed_at);
  for (const r of reactions8w ?? []) addActivity(r.created_at);
  for (const m of messages30d ?? []) addActivity(m.created_at);
  const peakActivity = Array.from(activityByDowHour.entries())
    .map(([slot, count]) => ({ slot, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="mt-2 text-muted">Platform health, growth, and engagement.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total users", totalUsers ?? 0],
          ["Total posts", totalPosts ?? 0],
          ["Total messages", totalMessages ?? 0],
          ["Total reactions", totalReactions ?? 0],
          ["Total comments", totalComments ?? 0],
          ["Total follows", totalFollows ?? 0],
          ["Signups (7d)", newSignups7d ?? 0],
          ["Posts (7d)", newPosts7d ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{fmt(Number(value))}</p>
          </div>
        ))}
      </section>

      <AnalyticsCharts
        userGrowth={userGrowth}
        postActivity={postActivity}
        postsPerUserWeekly={postsPerUserWeekly}
        topUserSeriesKeys={topUserSeriesKeys}
        weeklyEngagement={weeklyEngagement}
        messageVolume={messageVolume}
      />

      <section className="card overflow-x-auto p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Top posts this week</h2>
        <table className="mt-4 w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Author</th>
              <th className="py-2 pr-4">Views</th>
              <th className="py-2 pr-4">Reactions</th>
              <th className="py-2 pr-4">Comments</th>
            </tr>
          </thead>
          <tbody>
            {topPostsRaw.map((row) => {
              const author = authorById.get(row.post.user_id);
              return (
                <tr key={row.post.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-foreground">{row.post.title}</td>
                  <td className="py-2 pr-4 text-muted">
                    {author?.name?.trim() || author?.username || "Unknown"}
                  </td>
                  <td className="py-2 pr-4 text-muted">{fmt(row.viewCount)}</td>
                  <td className="py-2 pr-4 text-muted">{fmt(row.reactionCount)}</td>
                  <td className="py-2 pr-4 text-muted">{fmt(row.commentCount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {topPostsRaw.length === 0 ? <p className="mt-3 text-sm text-muted">No viewed posts this week.</p> : null}
      </section>

      <section className="card overflow-x-auto p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Posts per user</h2>
        <table className="mt-4 w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Post count</th>
              <th className="py-2 pr-4">Total views</th>
            </tr>
          </thead>
          <tbody>
            {topPublishers.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
                <td className="py-2 pr-4 text-muted">{row.username ? `@${row.username}` : "—"}</td>
                <td className="py-2 pr-4 text-muted">{fmt(row.postCount)}</td>
                <td className="py-2 pr-4 text-muted">{fmt(row.totalViews)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {topPublishers.length === 0 ? <p className="mt-3 text-sm text-muted">No publishers yet.</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Avg reactions/post", value: avgReactionsPerPost, decimals: 2 },
          { label: "Avg comments/post", value: avgCommentsPerPost, decimals: 2 },
          { label: "Avg views/post", value: avgViewsPerPost, decimals: 2 },
          { label: "Avg read time (sec)", value: avgReadTimeSeconds, decimals: 1 },
        ].map((item) => (
          <div key={item.label} className="card p-5">
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
              {Number(item.value).toFixed(item.decimals)}
            </p>
          </div>
        ))}
      </section>

      <section className="card overflow-x-auto p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Retention by signup cohort (last 4 weeks)</h2>
        <table className="mt-4 w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-4">Signup week</th>
              <th className="py-2 pr-4">Users signed up</th>
              <th className="py-2 pr-4">Returned later</th>
              <th className="py-2 pr-4">Retention</th>
            </tr>
          </thead>
          <tbody>
            {retentionRows.map((row) => (
              <tr key={row.week} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-foreground">{row.week}</td>
                <td className="py-2 pr-4 text-muted">{fmt(row.signups)}</td>
                <td className="py-2 pr-4 text-muted">{fmt(row.returned)}</td>
                <td className="py-2 pr-4 text-muted">{row.retentionPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Peak activity by day/hour</h2>
        <p className="mt-1 text-sm text-muted">
          Combined events from post views, reactions, and messages.
        </p>
        <table className="mt-4 w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-4">Day + hour (UTC)</th>
              <th className="py-2 pr-4">Combined events</th>
            </tr>
          </thead>
          <tbody>
            {peakActivity.map((row) => (
              <tr key={row.slot} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-foreground">{row.slot}</td>
                <td className="py-2 pr-4 text-muted">{fmt(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {peakActivity.length === 0 ? <p className="mt-3 text-sm text-muted">No activity data yet.</p> : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">SEO &amp; Discovery</h2>
          <p className="mt-1 text-sm text-muted">Visibility signals and discoverability opportunities.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5">
            <p className="text-sm text-muted">Total indexed pages</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{fmt(totalIndexedPages)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-muted">Published posts</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{fmt(totalPublishedPosts)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-muted">Profile pages</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{fmt(indexedProfileUsers ?? 0)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-muted">Posts with zero views</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{fmt(zeroViewPostsAll.length)}</p>
          </div>
        </div>

        <div className="card overflow-x-auto p-5 md:p-6">
          <h3 className="text-lg font-semibold text-foreground">Top posts by views (all time)</h3>
          <table className="mt-4 w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Author</th>
                <th className="py-2 pr-4">Views</th>
              </tr>
            </thead>
            <tbody>
              {topPostsAllTimeRaw.map((row) => {
                const author = topAllTimeAuthorById.get(row.post.user_id);
                return (
                  <tr key={row.post.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">{row.post.title}</td>
                    <td className="py-2 pr-4 text-muted">{author?.name?.trim() || author?.username || "Unknown"}</td>
                    <td className="py-2 pr-4 text-muted">{fmt(row.viewCount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card overflow-x-auto p-5 md:p-6">
            <h3 className="text-lg font-semibold text-foreground">Average views by post age</h3>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="py-2 pr-4">Age bucket</th>
                  <th className="py-2 pr-4">Posts</th>
                  <th className="py-2 pr-4">Avg views/post</th>
                </tr>
              </thead>
              <tbody>
                {avgViewsByAge.map((r) => (
                  <tr key={r.label} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">{r.label}</td>
                    <td className="py-2 pr-4 text-muted">{fmt(r.posts)}</td>
                    <td className="py-2 pr-4 text-muted">{r.avgViews.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto p-5 md:p-6">
            <h3 className="text-lg font-semibold text-foreground">Common words in post titles</h3>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="py-2 pr-4">Word</th>
                  <th className="py-2 pr-4">Count</th>
                </tr>
              </thead>
              <tbody>
                {commonTitleWords.map(([word, count]) => (
                  <tr key={word} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">{word}</td>
                    <td className="py-2 pr-4 text-muted">{fmt(count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-x-auto p-5 md:p-6">
          <h3 className="text-lg font-semibold text-foreground">Published posts with zero views</h3>
          <table className="mt-4 w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Author</th>
              </tr>
            </thead>
            <tbody>
              {zeroViewPosts.map((p) => {
                const author = publisherUserById.get(p.user_id) ?? topAllTimeAuthorById.get(p.user_id);
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">{p.title}</td>
                    <td className="py-2 pr-4 text-muted">{author?.name?.trim() || author?.username || "Unknown"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {zeroViewPosts.length === 0 ? <p className="mt-3 text-sm text-muted">No zero-view posts.</p> : null}
        </div>
      </section>
    </div>
  );
}
