import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log("messages/conversations getUser", {
    userId: userData.user?.id ?? null,
    hasUser: !!userData.user,
    error: userError?.message ?? null,
  });
  const user = userData.user;
  console.log("messages/conversations userId", user?.id ?? null);
  if (!user) {
    return NextResponse.json({ conversations: [] });
  }
  const userId = user.id;
  const { data: participantRows, error: participantRowsError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  console.log("participant rows", participantRows, participantRowsError);

  const { data: myParts } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, typing_until, muted_until, is_request, is_admin")
    .eq("user_id", userId);
  console.log("myParts query result", myParts);
  const convIds = [...new Set((myParts ?? []).map((p) => p.conversation_id).filter(Boolean))];
  console.log("conversation IDs from participant rows", convIds);
  if (convIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const myReadByConv = new Map(
    (myParts ?? []).map((p) => [
      p.conversation_id,
      {
        last_read_at: p.last_read_at,
        typing_until: p.typing_until,
        muted_until: p.muted_until,
        is_request: p.is_request,
        is_admin: p.is_admin,
      },
    ]),
  );

  const { data: blocks } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
  const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id));
  console.log("blockedIds", Array.from(blockedIds));

  const { data: convRows, error: convRowsError } = await supabase
    .from("conversations")
    .select("id,updated_at,created_at,name,is_group,hidden_for")
    .in("id", convIds);
  console.log("conversation details query result", convRows, convRowsError);
  const convById = new Map((convRows ?? []).map((c) => [c.id, c]));
  console.log("convById size", convById.size);

  const { data: allParts, error: allPartsError } = await service
    .from("conversation_participants")
    .select("conversation_id, user_id, last_read_at, typing_until")
    .in("conversation_id", convIds)
    .neq("user_id", userId);
  console.log("allParts query result", allParts, allPartsError);

  const otherUserIdByConv = new Map<string, string>();
  for (const row of allParts ?? []) {
    if (row.user_id === userId) continue;
    otherUserIdByConv.set(row.conversation_id, row.user_id);
  }
  console.log("otherUserIdByConv entries", Array.from(otherUserIdByConv.entries()));

  const otherIds = [...new Set(Array.from(otherUserIdByConv.values()))];
  const { data: otherUsers, error: otherUsersError } = otherIds.length
    ? await supabase.from("users").select("id,name,username,photo_url,last_seen_at,show_online_status").in("id", otherIds)
    : {
        data: [] as Array<{
          id: string;
          name: string | null;
          username: string | null;
          photo_url: string | null;
          last_seen_at: string | null;
          show_online_status: boolean | null;
        }>,
        error: null as { message: string } | null,
      };
  console.log("otherUsers query result", otherUsers, otherUsersError);
  const userById = new Map((otherUsers ?? []).map((u) => [u.id, u]));

  const { data: rawMsgs, error: rawMsgsError } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,body,type,post_id,created_at,hidden_for")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })
    .limit(800);
  console.log("rawMsgs query result count/error", rawMsgs?.length ?? 0, rawMsgsError);

  const visible = (rawMsgs ?? []).filter(
    (m) =>
      !m.hidden_for?.includes(user.id) &&
      m.sender_id &&
      !blockedIds.has(m.sender_id),
  );
  console.log("visible messages count", visible.length);

  const lastByConv = new Map<string, (typeof visible)[0]>();
  for (const m of visible) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
  }
  console.log("lastByConv size", lastByConv.size);

  const postIds = [...new Set(visible.filter((m) => m.post_id).map((m) => m.post_id as string))];
  const { data: posts, error: postsError } = postIds.length
    ? await supabase.from("posts").select("id,title,slug,body_md,user_id,status").in("id", postIds)
    : {
        data: [] as Array<{ id: string; title: string; slug: string; body_md: string; user_id: string; status: string }>,
        error: null as { message: string } | null,
      };
  console.log("posts query result count/error", posts?.length ?? 0, postsError);
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  const mappedConversations = convIds.map((convId) => convById.get(convId));
  console.log("mapped conversation details before filter", mappedConversations);
  const filteredConversations = mappedConversations
    .filter(
      (c): c is {
        id: string;
        updated_at: string;
        created_at: string;
        name: string | null;
        is_group: boolean;
        hidden_for: string[] | null;
      } => !!c,
    )
    .filter((c) => !Array.isArray(c.hidden_for) || !c.hidden_for.includes(userId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  console.log("conversation details after filter/sort", filteredConversations);
  const conversations = filteredConversations
    .map((c) => {
    const otherId = otherUserIdByConv.get(c.id);
    const other = otherId ? userById.get(otherId) : null;
    const last = lastByConv.get(c.id);
    let preview = "";
    if (last) {
      if (last.type === "post_share" && last.post_id) {
        const p = postById.get(last.post_id);
        preview = p ? `Shared post: ${p.title}` : "Shared a post";
      } else if (last.type === "image") {
        preview = last.body?.trim() ? `Image: ${last.body.trim()}` : "Sent an image";
      } else {
        preview = (last.body ?? "").trim() || "(message)";
      }
    }
    const myPart = myReadByConv.get(c.id);
    const unreadMessages = visible.filter(
      (m) =>
        m.conversation_id === c.id &&
        m.sender_id !== user.id &&
        (!myPart?.last_read_at || new Date(m.created_at).getTime() > new Date(myPart.last_read_at).getTime()),
    );
    const unreadCount = unreadMessages.length;
    const unread = unreadCount > 0;

    const otherPart = (allParts ?? []).find((p) => p.conversation_id === c.id && p.user_id !== user.id);
    const peerTyping = !!(otherPart?.typing_until && new Date(otherPart.typing_until).getTime() > now);

    return {
      id: c.id,
      updated_at: c.updated_at,
      is_group: !!c.is_group,
      name: c.name,
      other: other
        ? {
            id: other.id,
            name: other.name,
            username: other.username,
            photo_url: other.photo_url,
          }
        : { id: otherId ?? "", name: null, username: null, photo_url: null },
      last_preview: preview,
      unread,
      unread_count: unreadCount,
      muted: !!(myPart?.muted_until && new Date(myPart.muted_until).getTime() > now),
      is_request: !!myPart?.is_request,
      is_admin: !!myPart?.is_admin,
      member_count: 1 + (allParts ?? []).filter((p) => p.conversation_id === c.id).length,
      other_last_seen_at: other?.show_online_status ? (other as { last_seen_at?: string | null }).last_seen_at ?? null : null,
      peer_typing: peerTyping,
    };
  });

  console.log("final conversations response", JSON.stringify(conversations, null, 2));
  return NextResponse.json({ conversations });
}
