import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0, messageUnreadCount: 0, preview: [] });
  }

  const [{ count: unreadCount }, { data: unreadRows }, { data: msgUnreadRaw, error: msgUnreadErr }] =
    await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
    supabase
      .from("notifications")
      .select("id,type,message,post_id,actor_id,conversation_id,created_at")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.rpc("unread_message_count"),
  ]);
  if (msgUnreadErr) {
    console.error("unread_message_count", msgUnreadErr);
  }
  const messageUnreadCount = typeof msgUnreadRaw === "number" ? msgUnreadRaw : 0;

  const actorIds = Array.from(new Set((unreadRows ?? []).map((n) => n.actor_id).filter(Boolean)));
  const postIds = Array.from(new Set((unreadRows ?? []).map((n) => n.post_id).filter(Boolean)));
  const [{ data: actors }, { data: posts }] = await Promise.all([
    actorIds.length
      ? supabase.from("users").select("id,name,username,photo_url").in("id", actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }> }),
    postIds.length
      ? supabase.from("posts").select("id,title,slug,user_id").in("id", postIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; slug: string; user_id: string }> }),
  ]);

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.user_id)));
  const { data: postAuthors } = authorIds.length
    ? await supabase.from("users").select("id,username").in("id", authorIds)
    : { data: [] as Array<{ id: string; username: string | null }> };

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const authorById = new Map((postAuthors ?? []).map((u) => [u.id, u]));

  const preview = (unreadRows ?? []).map((n) => {
    const actor = n.actor_id ? actorById.get(n.actor_id) : null;
    const post = n.post_id ? postById.get(n.post_id) : null;
    const postAuthor = post ? authorById.get(post.user_id) : null;
    const href =
      n.type === "message" && n.conversation_id
        ? `/messages?c=${n.conversation_id}`
        : n.type === "follow"
          ? actor?.username
            ? `/u/${actor.username}`
            : "/notifications"
          : n.post_id && post?.slug && postAuthor?.username
            ? `/u/${postAuthor.username}/${post.slug}`
            : "/notifications";
    return {
      id: n.id,
      type: n.type,
      message: n.message,
      created_at: n.created_at,
      href,
      actor_name: actor?.name ?? null,
      actor_username: actor?.username ?? null,
      actor_photo_url: actor?.photo_url ?? null,
      post_title: post?.title ?? null,
    };
  });

  return NextResponse.json({
    unreadCount: unreadCount ?? 0,
    messageUnreadCount,
    preview,
  });
}
