import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function snippetFromMd(bodyMd: string, max = 120) {
  const t = bodyMd.replace(/[#*`_[\]()]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await context.params;
  if (!uuidRe.test(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: part } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!part) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: blocks } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
  const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id));

  const { data: allParts } = await supabase
    .from("conversation_participants")
    .select("user_id, typing_until,last_read_at,muted_until,is_admin,is_request")
    .eq("conversation_id", conversationId);
  const otherPart = (allParts ?? []).find((p) => p.user_id !== user.id);
  const now = Date.now();
  const peerTyping = !!(otherPart?.typing_until && new Date(otherPart.typing_until).getTime() > now);
  const otherLastReadAt = otherPart?.last_read_at ?? null;
  const myPart = (allParts ?? []).find((p) => p.user_id === user.id);
  const mutedUntil = myPart?.muted_until ?? null;

  const otherUserId = otherPart?.user_id;
  const { data: otherUser } = otherUserId
    ? await supabase
        .from("users")
        .select("id,name,username,photo_url,last_seen_at,show_online_status")
        .eq("id", otherUserId)
        .maybeSingle()
    : { data: null };
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,name,is_group")
    .eq("id", conversationId)
    .maybeSingle();

  let blocked_by_me = false;
  if (otherUserId) {
    const { data: blk } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherUserId)
      .maybeSingle();
    blocked_by_me = !!blk;
  }

  const { data: rawMsgs } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,body,type,post_id,image_url,link_preview,parent_message_id,created_at,edited_at,deleted,hidden_for")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(400);

  const postIds = [...new Set((rawMsgs ?? []).filter((m) => m.post_id).map((m) => m.post_id as string))];
  const { data: posts } = postIds.length
    ? await supabase.from("posts").select("id,title,slug,body_md,user_id,status").in("id", postIds)
    : { data: [] as Array<{ id: string; title: string; slug: string; body_md: string; user_id: string; status: string }> };
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));

  const authorIds = [...new Set((posts ?? []).map((p) => p.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("users").select("id,username").in("id", authorIds)
    : { data: [] as Array<{ id: string; username: string | null }> };
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));

  const senderIds = [...new Set((rawMsgs ?? []).map((m) => m.sender_id))];
  const { data: senders } = senderIds.length
    ? await supabase.from("users").select("id,name,username,photo_url").in("id", senderIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }> };
  const senderById = new Map((senders ?? []).map((s) => [s.id, s]));
  const messageIds = (rawMsgs ?? []).map((m) => m.id);
  const { data: reactionRows } = messageIds.length
    ? await supabase
        .from("message_reactions")
        .select("message_id,user_id,emoji")
        .in("message_id", messageIds)
    : { data: [] as Array<{ message_id: string; user_id: string; emoji: string }> };
  const reactionMap = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const row of reactionRows ?? []) {
    const byEmoji = reactionMap.get(row.message_id) ?? new Map();
    const existing = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
    existing.count += 1;
    if (row.user_id === user.id) existing.reactedByMe = true;
    byEmoji.set(row.emoji, existing);
    reactionMap.set(row.message_id, byEmoji);
  }

  const messages = (rawMsgs ?? [])
    .filter((m) => !m.hidden_for?.includes(user.id) && !blockedIds.has(m.sender_id))
    .map((m) => {
      const sender = senderById.get(m.sender_id);
      const post = m.post_id ? postById.get(m.post_id) : null;
      const author = post ? authorById.get(post.user_id) : null;
      return {
        id: m.id,
        sender_id: m.sender_id,
        body: m.body,
        type: m.type,
        post_id: m.post_id,
        image_url: m.image_url,
        link_preview: m.link_preview,
        parent_message_id: m.parent_message_id,
        created_at: m.created_at,
        edited_at: m.edited_at,
        deleted: !!m.deleted,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              username: sender.username,
              photo_url: sender.photo_url,
            }
          : null,
        post:
          post && m.type === "post_share"
            ? {
                id: post.id,
                title: post.title,
                slug: post.slug,
                snippet: snippetFromMd(post.body_md ?? ""),
                author_username: author?.username ?? null,
              }
            : null,
        parent_message:
          m.parent_message_id && (rawMsgs ?? []).some((x) => x.id === m.parent_message_id)
            ? (() => {
                const parent = (rawMsgs ?? []).find((x) => x.id === m.parent_message_id);
                if (!parent) return null;
                const parentSender = senderById.get(parent.sender_id);
                return {
                  id: parent.id,
                  sender_id: parent.sender_id,
                  sender_name: parentSender?.name ?? parentSender?.username ?? "User",
                  body: parent.deleted ? "This message was deleted" : parent.body,
                  deleted: !!parent.deleted,
                };
              })()
            : null,
        reactions: Array.from((reactionMap.get(m.id) ?? new Map()).entries()).map(([emoji, meta]) => ({
          emoji,
          count: meta.count,
          reactedByMe: meta.reactedByMe,
        })),
      };
    });

  return NextResponse.json({
    peer_typing: peerTyping,
    other_user:
      otherUser && otherUser.show_online_status === false
        ? { ...otherUser, last_seen_at: null }
        : otherUser,
    conversation,
    me_is_admin: !!(allParts ?? []).find((p) => p.user_id === user.id)?.is_admin,
    me_is_request: !!(allParts ?? []).find((p) => p.user_id === user.id)?.is_request,
    member_count: (allParts ?? []).length,
    members: allParts ?? [],
    other_last_read_at: otherLastReadAt,
    muted_until: mutedUntil,
    blocked_by_me,
    messages,
  });
}
