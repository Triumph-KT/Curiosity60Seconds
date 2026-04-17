"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  acceptMessageRequestAction,
  declineMessageRequestAction,
  deleteMessageAction,
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
} from "@/app/actions";

type ConvRow = {
  id: string;
  updated_at: string;
  other: { id: string; name: string | null; username: string | null; photo_url: string | null };
  last_preview: string;
  unread: boolean;
  unread_count?: number;
  muted?: boolean;
  is_request?: boolean;
  name?: string | null;
  is_group?: boolean;
  member_count?: number;
  other_last_seen_at?: string | null;
  peer_typing: boolean;
};

type LinkPreview = { url: string; title?: string | null; description?: string | null; image?: string | null };

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

export function MessagingWidget({ userId }: { userId: string }) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "thread">("list");
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string | null;
    username: string | null;
    photo_url: string | null;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MsgRow | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<
    Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }>
  >([]);
  const [pending, startTransition] = useTransition();
  const [listTab, setListTab] = useState<"inbox" | "requests">("inbox");
  const [isSelectingUser, startSelectTransition] = useTransition();
  const inputFocusedRef = useRef(false);
  const composeDebounceRef = useRef<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const linkDebounceRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setUnreadTotal(data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

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
        other_last_read_at?: string | null;
        muted_until?: string | null;
        other_user: { id: string; name: string | null; username: string | null; photo_url: string | null } | null;
      };
      setMessages(data.messages ?? []);
      setPeerTyping(!!data.peer_typing);
      setOtherUser(data.other_user ?? null);
      setOtherLastReadAt(data.other_last_read_at ?? null);
      setMutedUntil(data.muted_until ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(refreshUnread, 15000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void refreshConversations();
    const id = window.setInterval(refreshConversations, 15000);
    return () => window.clearInterval(id);
  }, [open, refreshConversations]);

  useEffect(() => {
    if (!open || !activeId) return;
    void refreshThread(activeId);
    void markConversationReadAction(activeId);
    const id = window.setInterval(() => void refreshThread(activeId), 15000);
    return () => window.clearInterval(id);
  }, [open, activeId, refreshThread]);

  useEffect(() => {
    if (!open || !activeId || !inputFocusedRef.current) return;
    const id = window.setInterval(() => {
      void setConversationTypingAction(activeId);
    }, 3000);
    return () => window.clearInterval(id);
  }, [open, activeId, draft]);

  function openConversation(id: string) {
    setActiveId(id);
    setView("thread");
    setComposeOpen(false);
    setComposeQuery("");
    setComposeResults([]);
    void markConversationReadAction(id);
    void refreshThread(id);
    void refreshConversations();
    void refreshUnread();
  }

  function backToList() {
    setView("list");
    setActiveId(null);
    setOtherUser(null);
    void refreshConversations();
    void refreshUnread();
  }

  function minimize() {
    setOpen(false);
    setView("list");
    setActiveId(null);
    void refreshUnread();
  }

  async function handleSend() {
    if (!activeId || (!draft.trim() && !selectedImage)) return;
    const text = draft.trim();
    setDraft("");
    const imageToSend = selectedImage;
    const previewToSend = linkPreview;
    setSelectedImage(null);
    setSelectedImagePreview(null);
    setLinkPreview(null);
    startTransition(async () => {
      try {
        if (imageToSend) {
          await sendImageMessageAction(activeId, imageToSend, text || undefined, replyTo?.id ?? null);
        } else {
          await sendMessageAction(activeId, text, null, replyTo?.id ?? null, { linkPreview: previewToSend });
        }
        setReplyTo(null);
        await refreshThread(activeId);
        await refreshConversations();
        await refreshUnread();
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

  async function handleEditSave(messageId: string) {
    const text = editingDraft.trim();
    if (!text) return;
    try {
      await editMessageAction(messageId, text);
      setEditingMessageId(null);
      setEditingDraft("");
      if (activeId) await refreshThread(activeId);
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

  useEffect(() => {
    if (!composeOpen) return;
    if (composeDebounceRef.current !== null) {
      window.clearTimeout(composeDebounceRef.current);
    }
    composeDebounceRef.current = window.setTimeout(() => {
      const token = composeQuery.trim();
      if (!token) {
        setComposeResults([]);
        return;
      }
      startSelectTransition(async () => {
        try {
          const rows = await searchShareableUsersAction(token);
          setComposeResults(rows);
        } catch {
          setComposeResults([]);
        }
      });
    }, 300);
    return () => {
      if (composeDebounceRef.current !== null) {
        window.clearTimeout(composeDebounceRef.current);
      }
    };
  }, [composeOpen, composeQuery]);

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
          if (!res.ok) return;
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

  async function startConversationWithUser(targetUserId: string) {
    startSelectTransition(async () => {
      try {
        const conversationId = await getOrCreateConversationAction(targetUserId);
        openConversation(conversationId);
      } catch (error) {
        console.error(error);
      }
    });
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
  async function toggleMute() {
    if (!activeId) return;
    try {
      if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
        await unmuteConversationAction(activeId);
      } else {
        await muteConversationAction(activeId, 8);
      }
      await refreshConversations();
      await refreshThread(activeId);
    } catch (error) {
      console.error(error);
    }
  }

  function onPickImage(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedImage(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  }
  const reactionOptions = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
  const isMuted = !!(mutedUntil && new Date(mutedUntil).getTime() > Date.now());
  const sentStatusFor = (message: MsgRow) => {
    if (!otherLastReadAt) return { icon: "✓", className: "text-muted" };
    const readAt = new Date(otherLastReadAt).getTime();
    const createdAt = new Date(message.created_at).getTime();
    if (readAt >= createdAt) return { icon: "✓✓", className: "text-amber-600" };
    return { icon: "✓✓", className: "text-muted" };
  };
  const presenceLabel = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return null;
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    if (diffMs <= 2 * 60 * 1000) return "● Online";
    if (diffMs <= 24 * 60 * 60 * 1000) return `● Active ${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
    return null;
  };
  const conversationsInbox = conversations.filter((c) => !c.is_request);
  const conversationsRequests = conversations.filter((c) => c.is_request);

  if (isMobile) {
    return (
      <Link
        href="/messages"
        className="fixed bottom-5 right-5 z-[60] rounded-full border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg md:hidden"
      >
        Messages
        {unreadTotal > 0 ? (
          <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-foreground">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open messages"
        onClick={() => {
          setOpen(true);
          void refreshConversations();
          void refreshUnread();
        }}
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/30 bg-primary text-2xl text-white shadow-lg transition hover:bg-primary-hover"
      >
        💬
        {unreadTotal > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-foreground">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60] hidden h-[min(40rem,calc(100vh-8rem))] w-[22rem] min-w-[22rem] min-h-[31.25rem] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl md:flex">
      <div className="flex items-center justify-between border-b border-border bg-canvas px-3 py-2">
        <span className="text-sm font-semibold text-foreground">{view === "list" ? "Messages" : "Conversation"}</span>
        <div className="flex gap-1">
          {view === "thread" ? (
            <button type="button" onClick={backToList} className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-white">
              Back
            </button>
          ) : null}
          <button type="button" onClick={minimize} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-white">
            Close
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Conversations</span>
              <button
                type="button"
                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground hover:bg-canvas"
                onClick={() => setComposeOpen((v) => !v)}
              >
                ✏️ New
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] ${listTab === "inbox" ? "bg-primary text-white" : "bg-canvas text-foreground"}`}
                onClick={() => setListTab("inbox")}
              >
                Inbox
              </button>
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] ${listTab === "requests" ? "bg-primary text-white" : "bg-canvas text-foreground"}`}
                onClick={() => setListTab("requests")}
              >
                Requests {conversationsRequests.length > 0 ? `(${conversationsRequests.length})` : ""}
              </button>
            </div>
            {composeOpen ? (
              <div className="mt-2 space-y-2">
                <input
                  className="input-field py-2 text-sm"
                  placeholder="Search people..."
                  value={composeQuery}
                  onChange={(e) => setComposeQuery(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border">
                  {composeQuery.trim() === "" ? (
                    <p className="px-3 py-2 text-xs text-muted">Search by name or username</p>
                  ) : composeResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">{isSelectingUser ? "Searching..." : "No users found"}</p>
                  ) : (
                    composeResults.map((u) => {
                      const name = u.name?.trim() || u.username || "User";
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas"
                          onClick={() => void startConversationWithUser(u.id)}
                        >
                          {u.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.photo_url} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-border" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-foreground">{name}</span>
                            {u.username ? <span className="block truncate text-[11px] text-muted">@{u.username}</span> : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
          {(listTab === "inbox" ? conversationsInbox : conversationsRequests).length === 0 ? (
            <p className="p-4 text-sm text-muted">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(listTab === "inbox" ? conversationsInbox : conversationsRequests).map((c) => {
                const label = c.is_group ? c.name || "Group" : c.other.name?.trim() || c.other.username || "User";
                return (
                  <li key={c.id}>
                    <div className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas">
                      {c.other.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.other.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                          {label.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate ${c.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
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
                        {presenceLabel(c.other_last_seen_at) ? (
                          <span className="block text-[10px] text-muted">{presenceLabel(c.other_last_seen_at)}</span>
                        ) : null}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" className="btn-secondary-sm px-2 py-1 text-[10px]" onClick={() => openConversation(c.id)}>
                          Open
                        </button>
                        {c.is_request ? (
                          <>
                            <button type="button" className="btn-primary-sm px-2 py-1 text-[10px]" onClick={() => void handleAcceptRequest(c.id)}>
                              Accept
                            </button>
                            <button type="button" className="btn-secondary-sm px-2 py-1 text-[10px]" onClick={() => void handleDeclineRequest(c.id)}>
                              Decline
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              {otherUser?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={otherUser.photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
                  {(otherUser?.name?.trim() || otherUser?.username || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {otherUser?.name?.trim() || otherUser?.username || "Conversation"}
                </p>
                {otherUser?.username ? <p className="truncate text-xs text-muted">@{otherUser.username}</p> : null}
                {activeId ? (
                  <p className="truncate text-[10px] text-muted">
                    {presenceLabel((conversations.find((c) => c.id === activeId)?.other_last_seen_at) ?? null)}
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn-secondary-sm px-2 py-1 text-[10px]" onClick={() => void toggleMute()}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {peerTyping ? (
              <p className="text-xs italic text-muted">Typing…</p>
            ) : null}
            {messages.map((m) => {
              const mine = m.sender_id === userId;
              const label = m.sender?.name?.trim() || m.sender?.username || "User";
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  {m.sender?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.sender.photo_url} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-border" />
                  ) : (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
                      {label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className={`max-w-[85%] space-y-1 ${mine ? "items-end text-right" : ""}`}>
                    {conversations.find((c) => c.id === activeId)?.is_group ? (
                      <p className={`text-[10px] font-semibold text-muted ${mine ? "text-right" : ""}`}>{label}</p>
                    ) : null}
                    <div
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        mine ? "border-primary/30 bg-primary/10 text-foreground" : "border-border bg-canvas text-foreground"
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
                          <p className="text-xs font-semibold uppercase text-muted">Shared post</p>
                          <p className="font-medium text-foreground">{m.post.title}</p>
                          <p className="text-xs text-muted line-clamp-3">{m.post.snippet}</p>
                          {m.post.author_username ? (
                            <Link
                              href={`/u/${m.post.author_username}/${m.post.slug}`}
                              className="inline-block text-xs font-semibold text-primary underline hover:text-primary-hover"
                            >
                              View post
                            </Link>
                          ) : null}
                        </div>
                      ) : m.type === "image" && m.image_url ? (
                        <div className="space-y-2 text-left">
                          <a href={m.image_url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.image_url} alt="Shared image" className="max-h-60 max-w-full rounded-lg object-contain" />
                          </a>
                          {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                        </div>
                      ) : m.deleted ? (
                        <p className="italic text-muted">This message was deleted</p>
                      ) : editingMessageId === m.id ? (
                        <div className="space-y-2">
                          <input
                            className="input-field py-1.5 text-xs"
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
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
                            <img src={m.link_preview.image} alt="" className="mb-1 h-20 w-full rounded object-cover" />
                          ) : null}
                          <p className="line-clamp-1 text-xs font-semibold text-foreground">{m.link_preview.title || m.link_preview.url}</p>
                          {m.link_preview.description ? (
                            <p className="line-clamp-2 text-[10px] text-muted">{m.link_preview.description}</p>
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
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${r.reactedByMe ? "border-primary/40 bg-primary/10" : "border-border bg-canvas"}`}
                            onClick={() => void handleToggleReaction(m.id, r.emoji)}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="group flex flex-wrap items-center gap-2 text-[10px] text-muted">
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
          <div className="border-t border-border p-2">
            {replyTo ? (
              <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-border bg-canvas px-2 py-1 text-[10px]">
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
              <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-border bg-canvas px-2 py-1 text-[10px]">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedImagePreview} alt="Selected" className="h-10 w-10 rounded object-cover" />
                  <span className="text-muted">Image ready</span>
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
                    <p className="line-clamp-1 text-[10px] font-semibold text-foreground">{linkPreview.title || linkPreview.url}</p>
                    {linkPreview.description ? <p className="line-clamp-2 text-[10px] text-muted">{linkPreview.description}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="text-[10px] text-muted"
                    onClick={() => {
                      setDismissedPreviewUrl(linkPreview.url);
                      setLinkPreview(null);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
              <button type="button" className="btn-secondary-sm shrink-0 px-2 py-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                🖼️
              </button>
              <input
                className="input-field flex-1 py-2 text-sm"
                placeholder="Message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
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
              <button type="button" className="btn-primary shrink-0 px-3 py-2 text-sm" disabled={pending} onClick={() => void handleSend()}>
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
