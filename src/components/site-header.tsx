"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction, markSingleNotificationReadAction } from "@/app/actions";

export type SiteHeaderUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  photo_url: string | null;
  role: "user" | "admin";
};

type NotificationPreviewItem = {
  id: string;
  type: string;
  message: string | null;
  created_at: string;
  href: string;
  actor_name: string | null;
  actor_username: string | null;
  actor_photo_url: string | null;
  post_title: string | null;
};

function navLinkClass(active: boolean) {
  return active
    ? "text-accent font-semibold"
    : "text-white/90 hover:text-accent transition-colors font-medium";
}

export function SiteHeader({
  user,
  initialUnreadCount = 0,
  initialMessageUnreadCount = 0,
  initialPreview = [],
}: {
  user: SiteHeaderUser | null;
  initialUnreadCount?: number;
  initialMessageUnreadCount?: number;
  initialPreview?: NotificationPreviewItem[];
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [messageUnreadCount, setMessageUnreadCount] = useState(initialMessageUnreadCount);
  const [preview, setPreview] = useState<NotificationPreviewItem[]>(initialPreview);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
    setMessageUnreadCount(initialMessageUnreadCount);
    setPreview(initialPreview);
  }, [initialUnreadCount, initialMessageUnreadCount, initialPreview]);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    async function refreshSummary() {
      try {
        const response = await fetch("/api/notifications/summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          unreadCount: number;
          messageUnreadCount?: number;
          preview: NotificationPreviewItem[];
        };
        if (stop) return;
        setUnreadCount(data.unreadCount ?? 0);
        setMessageUnreadCount(data.messageUnreadCount ?? 0);
        setPreview(data.preview ?? []);
      } catch {
        // ignore poll errors
      }
    }
    const id = window.setInterval(refreshSummary, 15000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [user?.id]);

  const homeActive = pathname === "/";
  const peopleActive = pathname === "/people";
  const feedActive = pathname.startsWith("/feed");
  const dashboardActive = pathname.startsWith("/dashboard");
  const messagesActive = pathname.startsWith("/messages");
  const settingsActive = pathname.startsWith("/settings");
  const adminActive = pathname.startsWith("/admin");

  const displayName = user?.name?.trim() || user?.email || "Account";
  const profileHref = user?.username ? `/u/${user.username}` : "/settings";
  const profileInitial = displayName.charAt(0).toUpperCase();
  const unreadBadge = unreadCount > 99 ? "99+" : String(unreadCount);
  const messageBadge = messageUnreadCount > 99 ? "99+" : String(messageUnreadCount);

  return (
    <header className="border-b border-black/10 bg-primary shadow-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-8">
          <Link
            href="/"
            className={`shrink-0 text-lg font-bold tracking-tight text-white ${homeActive ? "text-accent" : "hover:text-accent"}`}
          >
            Curiosity60Seconds
          </Link>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Link href="/people" className={navLinkClass(peopleActive)}>
              People
            </Link>
            {user ? (
              <>
                <Link href="/feed" className={navLinkClass(feedActive)}>
                  Feed
                </Link>
                <Link href="/dashboard" className={navLinkClass(dashboardActive)}>
                  Dashboard
                </Link>
                <Link href="/messages" className={`relative ${navLinkClass(messagesActive)}`}>
                  Messages
                  {messageUnreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1 py-0.5 text-[10px] font-bold leading-none text-foreground">
                      {messageBadge}
                    </span>
                  ) : null}
                </Link>
                <Link href="/settings" className={navLinkClass(settingsActive)}>
                  Settings
                </Link>
                {user.role === "admin" ? (
                  <Link href="/admin/overview" className={navLinkClass(adminActive)}>
                    Admin
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <Link href="/login" className={navLinkClass(pathname === "/login")}>
                  Login
                </Link>
                <Link href="/signup" className={navLinkClass(pathname === "/signup")}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        {user ? (
          <div className="flex shrink-0 items-center gap-2">
            <details className="relative">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-lg text-white transition-colors hover:border-accent hover:bg-white/15">
                  🔔
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                      {unreadBadge}
                    </span>
                  ) : null}
                </span>
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface py-2 shadow-lg">
                <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Unread notifications</p>
                {preview.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">No unread notifications.</p>
                ) : (
                  preview.map((item) => {
                    const actorName = item.actor_name?.trim() || item.actor_username || "Someone";
                    return (
                      <form key={item.id} action={markSingleNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={item.id} />
                        <input type="hidden" name="redirectTo" value={item.href} />
                        <button
                          type="submit"
                          className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-canvas"
                        >
                          {item.actor_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.actor_photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-border" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
                              {actorName.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-foreground">
                              {item.message ?? `${actorName} sent a notification`}
                            </span>
                            <span className="mt-1 block text-xs text-muted">
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </span>
                        </button>
                      </form>
                    );
                  })
                )}
                <Link
                  href="/notifications"
                  className="mt-2 block border-t border-border px-4 py-2 text-sm font-medium text-primary hover:bg-canvas"
                >
                  See all notifications
                </Link>
              </div>
            </details>
            <details className="relative">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 p-0.5 pr-3 transition-colors hover:border-accent hover:bg-white/15">
                  {user.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photo_url}
                      alt={displayName}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-foreground">
                      {profileInitial}
                    </span>
                  )}
                  <span className="hidden max-w-[8rem] truncate text-sm text-white sm:inline">
                    {displayName}
                  </span>
                </span>
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface py-2 shadow-lg">
                <Link
                  href={profileHref}
                  className="block px-4 py-2.5 text-sm text-foreground hover:bg-canvas"
                >
                  My profile
                </Link>
                <Link href="/settings" className="block px-4 py-2.5 text-sm text-foreground hover:bg-canvas">
                  Account settings
                </Link>
                <form action={logoutAction} className="border-t border-border px-2 pt-2">
                  <button
                    type="submit"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-canvas"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </details>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
