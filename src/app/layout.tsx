import Link from "next/link";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MessagingWidget } from "@/components/messaging-widget";
import { PresencePinger } from "@/components/presence-pinger";
import { SiteHeader } from "@/components/site-header";
import { getCurrentAppUser } from "@/lib/data";
import { getAppBaseUrl } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: "Curiosity60Seconds",
  description: "Knowledge externalization platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const [{ count: unreadCount }, { data: unreadRows }, { data: messageUnreadRaw, error: messageUnreadErr }] = user
    ? await Promise.all([
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
      ])
    : [
        { count: 0 } as { count: number | null },
        {
          data: [] as Array<{
            id: string;
            type: string;
            message: string | null;
            post_id: string | null;
            actor_id: string | null;
            conversation_id: string | null;
            created_at: string;
          }>,
        },
        { data: 0 as number | null, error: null as { message: string } | null },
      ];
  if (user && messageUnreadErr) {
    console.error("unread_message_count", messageUnreadErr);
  }
  const initialMessageUnreadCount = user
    ? typeof messageUnreadRaw === "number"
      ? messageUnreadRaw
      : 0
    : 0;

  const actorIds = Array.from(new Set((unreadRows ?? []).map((n) => n.actor_id).filter(Boolean)));
  const postIds = Array.from(new Set((unreadRows ?? []).map((n) => n.post_id).filter(Boolean)));
  const [{ data: actors }, { data: posts }] = await Promise.all([
    actorIds.length
      ? supabase.from("users").select("id,name,username,photo_url").in("id", actorIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string | null;
            username: string | null;
            photo_url: string | null;
          }>,
        }),
    postIds.length
      ? supabase.from("posts").select("id,title,slug,user_id").in("id", postIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; title: string; slug: string; user_id: string }>,
        }),
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-canvas text-foreground">
        <SiteHeader
          user={
            user
              ? {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  username: user.username,
                  photo_url: user.photo_url,
                  role: user.role,
                }
              : null
          }
          publishCta={
            user ? (
              <Link
                href="/new"
                className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-md transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              >
                Publish Now
              </Link>
            ) : null
          }
          initialUnreadCount={unreadCount ?? 0}
          initialMessageUnreadCount={initialMessageUnreadCount}
          initialPreview={preview}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
        {user ? <PresencePinger /> : null}
        {user ? <MessagingWidget userId={user.id} /> : null}
        <footer className="mt-auto border-t border-border bg-surface py-8 text-center text-sm text-muted">
          <p>
            <Link href="/" className="font-semibold text-primary hover:underline">
              Curiosity60Seconds
            </Link>
            {" · "}
            Externalize curiosity into published insight.
          </p>
        </footer>
      </body>
    </html>
  );
}
