import Link from "next/link";
import { redirect } from "next/navigation";
import {
  clearReadNotificationsAction,
  markNotificationsReadAction,
  markSingleNotificationReadAction,
} from "@/app/actions";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { requireActiveAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

type FilterKey = "all" | "posts" | "comments" | "follows" | "shares" | "messages" | "collaborations" | "system";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "posts", label: "Posts" },
  { key: "comments", label: "Comments" },
  { key: "follows", label: "Follows" },
  { key: "shares", label: "Shares" },
  { key: "messages", label: "Messages" },
  { key: "collaborations", label: "Collaborations" },
  { key: "system", label: "System" },
];

function typesForFilter(filter: FilterKey): string[] | null {
  switch (filter) {
    case "posts":
      return ["repost", "reaction"];
    case "comments":
      return ["comment", "reply"];
    case "follows":
      return ["follow"];
    case "shares":
      return ["share"];
    case "messages":
      return ["message"];
    case "collaborations":
      return ["collaboration_request", "collaboration_approved"];
    case "system":
      return ["system"];
    case "all":
    default:
      return null;
  }
}

function filterHref(filter: FilterKey, page: number) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/notifications?${qs}` : "/notifications";
}

function messageForNotification(params: {
  type: string;
  actorName: string;
  postTitle: string | null;
  fallbackMessage: string | null;
}) {
  const { type, actorName, postTitle, fallbackMessage } = params;
  const titled = postTitle ?? "this post";
  switch (type) {
    case "repost":
      return `${actorName} reposted your post: ${titled}`;
    case "reaction":
      return `${actorName} reacted to your post: ${titled}`;
    case "comment":
      return `${actorName} commented on your post: ${titled}`;
    case "reply":
      return `${actorName} replied to your comment on: ${titled}`;
    case "follow":
      return `${actorName} started following you`;
    case "share":
      return `${actorName} shared a post with you: ${titled}`;
    case "message":
      return fallbackMessage ?? `${actorName} sent you a message`;
    case "collaboration_request":
      return `${actorName} requested to collaborate on: ${titled}`;
    case "collaboration_approved":
      return `Your collaboration request was approved for: ${titled}`;
    case "system":
      return fallbackMessage ?? "System notification";
    default:
      return fallbackMessage ?? "Notification";
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as FilterKey) : "all";
  const { from, to } = rangeForPage(page, PAGE_SIZE);
  const filterTypes = typesForFilter(filter);

  let query = supabase
    .from("notifications")
    .select("id,type,message,read,actor_id,post_id,conversation_id,created_at", { count: "exact" })
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });
  if (filterTypes) query = query.in("type", filterTypes);

  const { data: rows, count } = await query.range(from, to);
  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (page !== safePage) {
    redirect(filterHref(filter, safePage));
  }

  const actorIds = Array.from(new Set((rows ?? []).map((n) => n.actor_id).filter(Boolean)));
  const postIds = Array.from(new Set((rows ?? []).map((n) => n.post_id).filter(Boolean)));
  const [{ data: actors }, { data: posts }, { count: unreadCount }] = await Promise.all([
    actorIds.length
      ? supabase.from("users").select("id,name,username,photo_url").in("id", actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }> }),
    postIds.length
      ? supabase.from("posts").select("id,title,slug,user_id").in("id", postIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; slug: string; user_id: string }> }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", appUser.id)
      .eq("read", false),
  ]);

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.user_id)));
  const { data: postAuthors } = authorIds.length
    ? await supabase.from("users").select("id,username").in("id", authorIds)
    : { data: [] as Array<{ id: string; username: string | null }> };

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const authorById = new Map((postAuthors ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="mt-2 text-muted">Recent updates about your activity and posts.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={markNotificationsReadAction}>
            <button type="submit" className="btn-secondary-sm">
              Mark all as read
            </button>
          </form>
          <form action={clearReadNotificationsAction}>
            <button type="submit" className="btn-secondary-sm">
              Clear all
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={filterHref(f.key, 1)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                active
                  ? "bg-primary text-white"
                  : "border border-border bg-surface text-foreground hover:bg-canvas"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <section className="card divide-y divide-border p-2 md:p-4">
        {(rows ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">No notifications.</div>
        ) : (
          (rows ?? []).map((n) => {
            const actor = n.actor_id ? actorById.get(n.actor_id) : null;
            const post = n.post_id ? postById.get(n.post_id) : null;
            const postAuthor = post ? authorById.get(post.user_id) : null;
            const actorName = actor?.name?.trim() || actor?.username || "Someone";
            const message = messageForNotification({
              type: n.type,
              actorName,
              postTitle: post?.title ?? null,
              fallbackMessage: n.message,
            });
            const redirectTo =
              n.type === "message" && n.conversation_id
                ? `/messages?c=${n.conversation_id}`
                : n.type === "follow"
                  ? actor?.username
                    ? `/u/${actor.username}`
                    : "/notifications"
                  : n.post_id && post?.slug && postAuthor?.username
                    ? `/u/${postAuthor.username}/${post.slug}`
                    : "/notifications";
            const initial = actorName.charAt(0).toUpperCase();
            return (
              <form key={n.id} action={markSingleNotificationReadAction}>
                <input type="hidden" name="notificationId" value={n.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button
                  type="submit"
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    n.read ? "hover:bg-canvas" : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  {actor?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actor.photo_url} alt="" className="mt-0.5 h-9 w-9 rounded-full object-cover ring-2 ring-border" />
                  ) : (
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
                      {initial}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{message}</span>
                    {post?.title ? (
                      <span className="mt-1 block text-xs text-muted">
                        Post: <span className="font-medium text-foreground">{post.title}</span>
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </span>
                </button>
              </form>
            );
          })
        )}
      </section>

      {(rows ?? []).length > 0 ? (
        <PaginationControls
          basePath="/notifications"
          page={safePage}
          totalPages={totalPages}
          extraSearchParams={filter === "all" ? undefined : { filter }}
        />
      ) : null}

      {unreadCount && unreadCount > 0 ? (
        <p className="text-sm text-muted">
          You have <span className="font-semibold text-foreground">{unreadCount}</span> unread notifications.
        </p>
      ) : null}
    </div>
  );
}
