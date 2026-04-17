"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  blockUserAction,
  acceptMessageRequestAction,
  createGroupConversationAction,
  deleteMessageAction,
  deleteConversationForSelfAction,
  declineMessageRequestAction,
  editMessageAction,
  getOrCreateConversationAction,
  markConversationReadAction,
  muteConversationAction,
  reportMessageAction,
  searchShareableUsersAction,
  sendImageMessageAction,
  sendMessageAction,
  setConversationTypingAction,
  toggleMessageReactionAction,
  unmuteConversationAction,
  unblockUserAction,
} from "@/app/actions";

type ConvRow = {
  id: string;
  updated_at: string;
  is_group?: boolean;
  name?: string | null;
  member_count?: number;
  is_request?: boolean;
  is_admin?: boolean;
  other_last_seen_at?: string | null;
  other: { id: string; name: string | null; username: string | null; photo_url: string | null };
  last_preview: string;
  unread: boolean;
  unread_count?: number;
  muted?: boolean;
  peer_typing: boolean;
};

type LinkPreview = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

type MsgRow = {
  id: string;
  sender_id: string;
  body: string | null;
  type: string;
  image_url?: string | null;
  link_preview?: LinkPreview | null;
  parent_message_id?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted?: boolean;
  parent_message?: {
    id: string;
    sender_id: string;
    sender_name: string;
    body: string | null;
    deleted: boolean;
  } | null;
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  sender: { id: string; name: string | null; username: string | null; photo_url: string | null } | null;
  post: {
    id: string;
    title: string;
    slug: string;
    snippet: string;
    author_username: string | null;
  } | null;
};

export function MessagesClient({
  initialConversationId,
  userId,
}: {
  initialConversationId: string | null;
  userId: string;
}) {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string | null;
    username: string | null;
    photo_url: string | null;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const inputFocusedRef = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MsgRow | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<
    Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }>
  >([]);
  const [isSelectingUser, startSelectTransition] = useTransition();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [listTab, setListTab] = useState<"inbox" | "requests">("inbox");
  const [threadSearch, setThreadSearch] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const composeDebounceRef = useRef<number | null>(null);
  const linkDebounceRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConvRow[] };
      setConversations(data.conversations ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshThread = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages/${conversationId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: MsgRow[];
        peer_typing: boolean;
        blocked_by_me?: boolean;
        other_last_read_at?: string | null;
        muted_until?: string | null;
        other_user: { id: string; name: string | null; username: string | null; photo_url: string | null } | null;
      };
      setMessages(data.messages ?? []);
      setPeerTyping(!!data.peer_typing);
      setOtherUser(data.other_user ?? null);
      setBlocked(!!data.blocked_by_me);
      setOtherLastReadAt(data.other_last_read_at ?? null);
      setMutedUntil(data.muted_until ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
    const id = window.setInterval(refreshConversations, 15000);
    return () => window.clearInterval(id);
  }, [refreshConversations]);

  useEffect(() => {
    if (!activeId) return;
    void refreshThread(activeId);
    void markConversationReadAction(activeId);
    const id = window.setInterval(() => void refreshThread(activeId), 15000);
    return () => window.clearInterval(id);
  }, [activeId, refreshThread]);

  useEffect(() => {
    if (!initialConversationId) return;
    setActiveId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!activeId || !inputFocusedRef.current) return;
    const id = window.setInterval(() => void setConversationTypingAction(activeId), 3000);
    return () => window.clearInterval(id);
  }, [activeId, draft]);

  useEffect(() => {
    if (!showNewMessage && !showNewGroup) return;
    if (composeDebounceRef.current !== null) window.clearTimeout(composeDebounceRef.current);
    composeDebounceRef.current = window.setTimeout(() => {
      const q = composeQuery.trim();
      if (!q) {
        setComposeResults([]);
        return;
      }
      startSelectTransition(async () => {
        try {
          const rows = await searchShareableUsersAction(q);
          setComposeResults(rows);
        } catch {
          setComposeResults([]);
        }
      });
    }, 300);
    return () => {
      if (composeDebounceRef.current !== null) window.clearTimeout(composeDebounceRef.current);
    };
  }, [showNewMessage, showNewGroup, composeQuery]);

  useEffect(() => {
    if (linkDebounceRef.current !== null) window.clearTimeout(linkDebounceRef.current);
    linkDebounceRef.current = window.setTimeout(() => {
      const text = draft.trim();
      const match = text.match(/https?:\/\/[^\s]+/i);
      const url = match?.[0] ?? null;
      if (!url || url === dismissedPreviewUrl) {
        setLinkPreview(null);
        return;
      }
      void (async () => {
        try {
          const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { cache: "no-store" });
          if (!res.ok) {
            setLinkPreview(null);
            return;
          }
          const data = (await res.json()) as LinkPreview;
          setLinkPreview(data.url ? data : null);
        } catch {
          setLinkPreview(null);
        }
      })();
    }, 500);
    return () => {
      if (linkDebounceRef.current !== null) window.clearTimeout(linkDebounceRef.current);
    };
  }, [draft, dismissedPreviewUrl]);

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (c.other.name ?? "").toLowerCase();
    const un = (c.other.username ?? "").toLowerCase();
    return name.includes(q) || un.includes(q);
  });
  const inboxConversations = filtered.filter((c) => !c.is_request);
  const requestConversations = filtered.filter((c) => c.is_request);
  const requestCount = requestConversations.length;

  async function handleSendReplyOrText() {
    if (!activeId || (!draft.trim() && !selectedImage)) return;
    const text = draft.trim();
    setDraft("");
    const parentId = replyTo?.id ?? null;
    const imageToSend = selectedImage;
    const previewToSend = linkPreview;
    setSelectedImage(null);
    setSelectedImagePreview(null);
    setLinkPreview(null);
    startTransition(async () => {
      try {
        if (imageToSend) {
          await sendImageMessageAction(activeId, imageToSend, text || undefined, parentId);
        } else {
          await sendMessageAction(activeId, text, null, parentId, { linkPreview: previewToSend });
        }
        setReplyTo(null);
        await refreshThread(activeId);
        await refreshConversations();
      } catch (e) {
        setDraft(text);
        if (imageToSend) {
          setSelectedImage(imageToSend);
          setSelectedImagePreview(URL.createObjectURL(imageToSend));
        }
        if (previewToSend) setLinkPreview(previewToSend);
        console.error(e);
      }
    });
  }

  async function handleReport(messageId: string) {
    const reason = window.prompt("Report reason (optional):") ?? "";
    try {
      await reportMessageAction(messageId, reason || undefined);
      if (activeId) await refreshThread(activeId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleBlock() {
    if (!otherUser?.id) return;
    try {
      if (blocked) await unblockUserAction(otherUser.id);
      else await blockUserAction(otherUser.id);
      setBlocked(!blocked);
      await refreshConversations();
      if (activeId) await refreshThread(activeId);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEditSave(messageId: string) {
    const text = editingDraft.trim();
    if (!text) return;
    try {
      await editMessageAction(messageId, text);
      setEditingMessageId(null);
      setEditingDraft("");
      if (activeId) await refreshThread(activeId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(messageId: string) {
    try {
      await deleteMessageAction(messageId);
      if (activeId) await refreshThread(activeId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    try {
      await toggleMessageReactionAction(messageId, emoji);
      setReactionPickerFor(null);
      if (activeId) await refreshThread(activeId);
    } catch (e) {
      console.error(e);
    }
  }

  async function openOrCreateConversation(userIdToMessage: string) {
    startSelectTransition(async () => {
      try {
        const conversationId = await getOrCreateConversationAction(userIdToMessage);
        setShowNewMessage(false);
        setComposeQuery("");
        setComposeResults([]);
        setActiveId(conversationId);
        await markConversationReadAction(conversationId);
        await refreshThread(conversationId);
        await refreshConversations();
      } catch (error) {
        console.error(error);
      }
    });
  }

  async function openConversationById(conversationId: string) {
    setActiveId(conversationId);
    await markConversationReadAction(conversationId);
    await refreshThread(conversationId);
    await refreshConversations();
  }

  async function handleAcceptRequest(conversationId: string) {
    try {
      await acceptMessageRequestAction(conversationId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeclineRequest(conversationId: string) {
    const ok = window.confirm("Decline this message request? The sender will not be notified.");
    if (!ok) return;
    try {
      await declineMessageRequestAction(conversationId);
      if (activeId === conversationId) setActiveId(null);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteConversationForSelf() {
    if (!activeId) return;
    const ok = window.confirm(
      "This will remove this conversation from your inbox only. The other person will still be able to see it. This cannot be undone.",
    );
    if (!ok) return;
    try {
      const target = activeId;
      await deleteConversationForSelfAction(target);
      setShowConversationMenu(false);
      setActiveId(null);
      setMessages([]);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateGroup() {
    try {
      const conversationId = await createGroupConversationAction(groupName, groupMemberIds);
      setShowNewGroup(false);
      setGroupName("");
      setGroupMemberIds([]);
      await refreshConversations();
      await openConversationById(conversationId);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMute(hours: number) {
    if (!activeId) return;
    try {
      await muteConversationAction(activeId, hours);
      setShowMuteMenu(false);
      await refreshConversations();
      await refreshThread(activeId);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUnmute() {
    if (!activeId) return;
    try {
      await unmuteConversationAction(activeId);
      setShowMuteMenu(false);
      await refreshConversations();
      await refreshThread(activeId);
    } catch (e) {
      console.error(e);
    }
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setSelectedImage(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  }

  const activeOther = conversations.find((c) => c.id === activeId)?.other ?? otherUser;
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const headerLabel =
    activeConversation?.is_group && activeConversation?.name
      ? activeConversation.name
      : activeOther?.name?.trim() || activeOther?.username || "Conversation";
  const reactionOptions = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
  const isMuted = !!(mutedUntil && new Date(mutedUntil).getTime() > Date.now());
  const normalizedSearch = threadSearch.trim().toLowerCase();
  const matchMessageIds = messages
    .filter((m) => !m.deleted && !!m.body && normalizedSearch && m.body.toLowerCase().includes(normalizedSearch))
    .map((m) => m.id);
  const totalMatches = matchMessageIds.length;
  const activeMatchId = totalMatches > 0 ? matchMessageIds[Math.max(0, Math.min(activeMatchIndex, totalMatches - 1))] : null;
  const sentStatusFor = (message: MsgRow) => {
    if (!otherLastReadAt) return { icon: "✓", className: "text-muted" };
    const readAt = new Date(otherLastReadAt).getTime();
    const createdAt = new Date(message.created_at).getTime();
    if (readAt >= createdAt) return { icon: "✓✓", className: "text-amber-600" };
    return { icon: "✓✓", className: "text-muted" };
  };
  const renderLastSeen = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return null;
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    if (diffMs <= 2 * 60 * 1000) return <span className="text-emerald-600">● Online</span>;
    if (diffMs <= 24 * 60 * 60 * 1000) return <span>● Active {Math.max(1, Math.floor(diffMs / 60000))}m ago</span>;
    return null;
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-4 lg:flex-row">
      <aside className="card flex w-full shrink-0 flex-col lg:max-w-sm">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="page-title text-xl">Messages</h1>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary-sm" onClick={() => setShowNewGroup((v) => !v)}>
                New Group
              </button>
              <button type="button" className="btn-secondary-sm" onClick={() => setShowNewMessage((v) => !v)}>
                New Message
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-xs ${listTab === "inbox" ? "bg-primary text-white" : "bg-canvas text-foreground"}`}
              onClick={() => setListTab("inbox")}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-xs ${listTab === "requests" ? "bg-primary text-white" : "bg-canvas text-foreground"}`}
              onClick={() => setListTab("requests")}
            >
              Requests {requestCount > 0 ? `(${requestCount})` : ""}
            </button>
          </div>
          <input
            className="input-field mt-3 py-2 text-sm"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {showNewMessage ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
              <input
                className="input-field py-2 text-sm"
                placeholder="Find user by name or username..."
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
                {composeQuery.trim() === "" ? (
                  <p className="px-3 py-2 text-xs text-muted">Search to start a new conversation.</p>
                ) : composeResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted">{isSelectingUser ? "Searching..." : "No users found."}</p>
                ) : (
                  composeResults.map((u) => {
                    const name = u.name?.trim() || u.username || "User";
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => void openOrCreateConversation(u.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas"
                      >
                        {u.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-border" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                          {u.username ? <span className="block truncate text-xs text-muted">@{u.username}</span> : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          {showNewGroup ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
              <input
                className="input-field py-2 text-sm"
                placeholder="Group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <input
                className="input-field py-2 text-sm"
                placeholder="Search users..."
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
              />
              <p className="text-xs text-muted">Select members:</p>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border">
                {composeResults.map((u) => {
                  const selected = groupMemberIds.includes(u.id);
                  return (
                    <button
                      key={`group-${u.id}`}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-canvas ${selected ? "bg-primary/10" : ""}`}
                      onClick={() =>
                        setGroupMemberIds((prev) => (prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                      }
                    >
                      <span className="text-xs">{u.name?.trim() || u.username || "User"}</span>
                      <span className="text-xs">{selected ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn-primary-sm" onClick={() => void handleCreateGroup()}>
                Create group
              </button>
            </div>
          ) : null}
        </div>
        <ul className="max-h-[50vh] min-h-0 flex-1 divide-y divide-border overflow-y-auto lg:max-h-none">
          {(listTab === "inbox" ? inboxConversations : requestConversations).length === 0 ? (
            <li className="p-4 text-sm text-muted">No conversations match.</li>
          ) : (
            (listTab === "inbox" ? inboxConversations : requestConversations).map((c) => {
              const label = c.is_group ? c.name || "Group" : c.other.name?.trim() || c.other.username || "User";
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <div className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-canvas ${active ? "bg-primary/5" : ""}`}>
                    {c.other.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.other.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                        {label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-foreground ${c.unread ? "font-bold" : "font-semibold"}`}>
                          {c.muted ? "🔕 " : ""}
                          {label}
                        </span>
                        {c.unread ? (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                            {c.unread_count ?? 1}
                          </span>
                        ) : null}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted">{c.last_preview || "—"}</span>
                      <span className="mt-1 block text-[11px] text-muted">{renderLastSeen(c.other_last_seen_at)}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" className="btn-secondary-sm" onClick={() => void openConversationById(c.id)}>
                        Open
                      </button>
                      {c.is_request ? (
                        <>
                          <button type="button" className="btn-primary-sm" onClick={() => void handleAcceptRequest(c.id)}>
                            Accept
                          </button>
                          <button type="button" className="btn-secondary-sm" onClick={() => void handleDeclineRequest(c.id)}>
                            Decline
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className="card flex min-h-[24rem] flex-1 flex-col">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">Select a conversation.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                {activeConversation?.is_group ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                    {(activeConversation.name ?? "G").slice(0, 2).toUpperCase()}
                  </span>
                ) : activeOther?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeOther.photo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-border" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                    {headerLabel.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-foreground">{headerLabel}</p>
                  {activeConversation?.is_group ? (
                    <p className="text-xs text-muted">{activeConversation.member_count ?? 0} members</p>
                  ) : null}
                  {!activeConversation?.is_group ? (
                    <p className="text-xs text-muted">{renderLastSeen(activeConversation?.other_last_seen_at)}</p>
                  ) : null}
                  {activeOther?.username ? (
                    <Link href={`/u/${activeOther.username}`} className="text-xs font-medium text-primary underline hover:text-primary-hover">
                      View profile
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="relative flex items-center gap-2">
                <button type="button" className="btn-secondary-sm" onClick={() => setShowConversationMenu((v) => !v)}>
                  ⋯
                </button>
                {showConversationMenu ? (
                  <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg">
                    <button
                      type="button"
                      className="block w-full rounded px-2 py-1 text-left text-xs text-red-700 hover:bg-canvas"
                      onClick={() => void handleDeleteConversationForSelf()}
                    >
                      Delete conversation
                    </button>
                  </div>
                ) : null}
                <button type="button" className="btn-secondary-sm" onClick={() => setShowThreadSearch((v) => !v)}>
                  🔍 Search
                </button>
                <button type="button" className="btn-secondary-sm" onClick={() => setShowMuteMenu((v) => !v)}>
                  {isMuted ? "Muted" : "Mute"}
                </button>
                {showMuteMenu ? (
                  <div className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-border bg-surface p-2 shadow-lg">
                    <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-canvas" onClick={() => void handleMute(1)}>
                      Mute for 1 hour
                    </button>
                    <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-canvas" onClick={() => void handleMute(8)}>
                      Mute for 8 hours
                    </button>
                    <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-canvas" onClick={() => void handleMute(24)}>
                      Mute for 24 hours
                    </button>
                    <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-canvas" onClick={() => void handleMute(10000)}>
                      Mute forever
                    </button>
                    {isMuted ? (
                      <button type="button" className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-canvas" onClick={() => void handleUnmute()}>
                        Unmute
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {otherUser?.id ? (
                  <button type="button" onClick={() => void toggleBlock()} className="btn-secondary-sm">
                    {blocked ? "Unblock" : "Block user"}
                  </button>
                ) : null}
              </div>
            </div>
            {showThreadSearch ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <input
                  className="input-field flex-1 py-2 text-sm"
                  placeholder="Search in this conversation..."
                  value={threadSearch}
                  onChange={(e) => {
                    setThreadSearch(e.target.value);
                    setActiveMatchIndex(0);
                  }}
                />
                <span className="text-xs text-muted">
                  {totalMatches > 0 ? `${Math.min(activeMatchIndex + 1, totalMatches)} of ${totalMatches}` : "0 matches"}
                </span>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => setActiveMatchIndex((prev) => (totalMatches ? (prev - 1 + totalMatches) % totalMatches : 0))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => setActiveMatchIndex((prev) => (totalMatches ? (prev + 1) % totalMatches : 0))}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => {
                    setShowThreadSearch(false);
                    setThreadSearch("");
                    setActiveMatchIndex(0);
                  }}
                >
                  Close
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {peerTyping ? (
                <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm italic text-muted">Typing…</p>
              ) : null}
              {messages.map((m) => {
                const mine = m.sender_id === userId;
                const label = m.sender?.name?.trim() || m.sender?.username || "User";
                return (
                  <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                    {m.sender?.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.sender.photo_url} alt="" className="mt-1 h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                        {label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className={`max-w-[min(32rem,85%)] space-y-1 ${mine ? "items-end text-right" : ""}`}>
                      {activeConversation?.is_group ? (
                        <p className={`text-xs font-semibold text-muted ${mine ? "text-right" : ""}`}>{label}</p>
                      ) : null}
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          mine ? "border-primary/30 bg-primary/10" : "border-border bg-canvas"
                        }`}
                      >
                        {m.parent_message ? (
                          <div className="mb-2 rounded-md border-l-2 border-border/80 bg-background/60 px-2 py-1 text-xs text-muted">
                            <p className="font-medium">{m.parent_message.sender_name}</p>
                            <p className="line-clamp-2">{m.parent_message.body ?? "This message was deleted"}</p>
                          </div>
                        ) : null}
                        {m.type === "post_share" && m.post ? (
                          <div className="space-y-2 text-left">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shared post</p>
                            <p className="text-base font-semibold text-foreground">{m.post.title}</p>
                            <p className="text-sm text-muted line-clamp-4">{m.post.snippet}</p>
                            {m.post.author_username ? (
                              <Link
                                href={`/u/${m.post.author_username}/${m.post.slug}`}
                                className="inline-flex text-sm font-semibold text-primary underline hover:text-primary-hover"
                              >
                                Open post
                              </Link>
                            ) : null}
                          </div>
                        ) : m.type === "image" && m.image_url ? (
                          <div className="space-y-2 text-left">
                            <a href={m.image_url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.image_url} alt="Shared image" className="max-h-72 max-w-full rounded-lg object-contain" />
                            </a>
                            {m.body ? <p className="whitespace-pre-wrap break-words text-foreground">{m.body}</p> : null}
                          </div>
                        ) : m.deleted ? (
                          <p className="italic text-muted">This message was deleted</p>
                        ) : editingMessageId === m.id ? (
                          <div className="space-y-2">
                            <input
                              className="input-field py-2 text-sm"
                              value={editingDraft}
                              onChange={(e) => setEditingDraft(e.target.value)}
                            />
                            <div className="flex items-center gap-2">
                              <button type="button" className="btn-primary-sm" onClick={() => void handleEditSave(m.id)}>
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn-secondary-sm"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingDraft("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className={`whitespace-pre-wrap break-words text-foreground ${
                              normalizedSearch && m.body?.toLowerCase().includes(normalizedSearch)
                                ? m.id === activeMatchId
                                  ? "bg-amber-200/60"
                                  : "bg-amber-100/40"
                                : ""
                            }`}
                          >
                            {m.body}
                          </p>
                        )}
                        {m.link_preview ? (
                          <a
                            href={m.link_preview.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block rounded-lg border border-border bg-background/70 p-2 text-left"
                          >
                            {m.link_preview.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.link_preview.image} alt="" className="mb-2 h-28 w-full rounded object-cover" />
                            ) : null}
                            <p className="line-clamp-1 text-sm font-semibold text-foreground">{m.link_preview.title || m.link_preview.url}</p>
                            {m.link_preview.description ? (
                              <p className="line-clamp-2 text-xs text-muted">{m.link_preview.description}</p>
                            ) : null}
                          </a>
                        ) : null}
                      </div>
                      {(m.reactions?.length ?? 0) > 0 ? (
                        <div className={`flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
                          {(m.reactions ?? []).map((r) => (
                            <button
                              key={`${m.id}-${r.emoji}`}
                              type="button"
                              className={`rounded-full border px-2 py-0.5 text-xs ${r.reactedByMe ? "border-primary/40 bg-primary/10" : "border-border bg-canvas"}`}
                              onClick={() => void handleToggleReaction(m.id, r.emoji)}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className={`group flex flex-wrap items-center gap-2 text-xs text-muted ${mine ? "justify-end" : ""}`}>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                        {m.edited_at ? <span>edited</span> : null}
                        {mine ? <span className={sentStatusFor(m).className}>{sentStatusFor(m).icon}</span> : null}
                        {reactionPickerFor === m.id ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5">
                            {reactionOptions.map((emoji) => (
                              <button key={emoji} type="button" onClick={() => void handleToggleReaction(m.id, emoji)}>
                                {emoji}
                              </button>
                            ))}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="invisible font-medium text-muted underline group-hover:visible"
                          onClick={() => setReplyTo(m)}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          className="invisible font-medium text-muted underline group-hover:visible"
                          onClick={() => setReactionPickerFor((prev) => (prev === m.id ? null : m.id))}
                        >
                          React
                        </button>
                        {!mine ? (
                          <button
                            type="button"
                            className="invisible font-medium text-primary underline group-hover:visible"
                            onClick={() => void handleReport(m.id)}
                          >
                            Report
                          </button>
                        ) : m.type === "text" && !m.deleted ? (
                          <>
                            <button
                              type="button"
                              className="invisible font-medium text-primary underline group-hover:visible"
                              onClick={() => {
                                setEditingMessageId(m.id);
                                setEditingDraft(m.body ?? "");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="invisible font-medium text-primary underline group-hover:visible"
                              onClick={() => void handleDelete(m.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : mine ? (
                          <button
                            type="button"
                            className="invisible font-medium text-primary underline group-hover:visible"
                            onClick={() => void handleDelete(m.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-4">
              {replyTo ? (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      Replying to {replyTo.sender?.name?.trim() || replyTo.sender?.username || "User"}
                    </p>
                    <p className="truncate text-muted">{(replyTo.body ?? "").slice(0, 80)}</p>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-muted">
                    ✕
                  </button>
                </div>
              ) : null}
              {selectedImagePreview ? (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedImagePreview} alt="Selected" className="h-12 w-12 rounded object-cover" />
                    <span className="text-muted">Image ready to send</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setSelectedImagePreview(null);
                    }}
                    className="text-muted"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
              {linkPreview ? (
                <div className="mb-2 rounded-lg border border-border bg-canvas p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs font-semibold text-foreground">{linkPreview.title || linkPreview.url}</p>
                      {linkPreview.description ? <p className="line-clamp-2 text-xs text-muted">{linkPreview.description}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted"
                      onClick={() => {
                        setDismissedPreviewUrl(linkPreview.url);
                        setLinkPreview(null);
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                  {linkPreview.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={linkPreview.image} alt="" className="mt-2 h-24 w-full rounded object-cover" />
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
                <button type="button" className="btn-secondary-sm shrink-0" onClick={() => fileInputRef.current?.click()}>
                  📎
                </button>
                <input
                  className="input-field flex-1"
                  placeholder="Write a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendReplyOrText();
                    }
                  }}
                  onFocus={() => {
                    inputFocusedRef.current = true;
                    if (activeId) void setConversationTypingAction(activeId);
                  }}
                  onBlur={() => {
                    inputFocusedRef.current = false;
                  }}
                />
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={pending}
                  onClick={() => void handleSendReplyOrText()}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
