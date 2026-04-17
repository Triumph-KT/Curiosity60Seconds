import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requestCollaborationAction } from "@/app/actions";
import { PostComments } from "@/components/post-comments";
import { PostMarkdown } from "@/components/post-markdown";
import { PostReactions } from "@/components/post-reactions";
import { PostRepostControls } from "@/components/post-repost";
import { PostShareControls } from "@/components/post-share";
import { PostViewTracker } from "@/components/post-view-tracker";
import { runDeletionCleanups } from "@/lib/deletion-cleanup";
import { estimateReadTimeLabel } from "@/lib/data";
import { isReactionType, type ReactionTypeKey } from "@/lib/reactions";
import { absoluteUrl, DEFAULT_OG_IMAGE, descriptionFromMarkdown } from "@/lib/seo";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id,title,body_md,published_at,updated_at,users!inner(name,username,onboarded,status)")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("users.username", username)
    .eq("users.onboarded", true)
    .eq("users.status", "active")
    .maybeSingle();
  const description = descriptionFromMarkdown(post?.body_md ?? "");
  const canonical = absoluteUrl(`/u/${username}/${slug}`);
  let ogImage = DEFAULT_OG_IMAGE;
  if (post?.id) {
    const { data: firstImage } = await supabase
      .from("sources")
      .select("image_url")
      .eq("post_id", post.id)
      .not("image_url", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstImage?.image_url) ogImage = firstImage.image_url;
  }
  const authorRaw = post?.users as
    | { name: string | null; username: string | null }
    | Array<{ name: string | null; username: string | null }>
    | null;
  const author = Array.isArray(authorRaw) ? authorRaw[0] ?? null : authorRaw;
  const authorName = author?.name?.trim() || author?.username || username;
  return {
    title: post?.title ?? "Post",
    description,
    alternates: { canonical },
    authors: [{ name: authorName }],
    openGraph: {
      title: post?.title ?? "Post",
      description,
      url: canonical,
      type: "article",
      images: [{ url: ogImage }],
      publishedTime: post?.published_at ?? undefined,
      modifiedTime: post?.updated_at ?? post?.published_at ?? undefined,
      authors: [authorName],
    },
    other: {
      "article:author": authorName,
      ...(post?.published_at ? { "article:published_time": post.published_at } : {}),
    },
  };
}

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const service = await createSupabaseServiceClient();
  await runDeletionCleanups(service);
  const supabase = await createSupabaseServerClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id,title,body_md,published_at,users!inner(id,name,username,photo_url,onboarded,status)")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("users.username", username)
    .eq("users.onboarded", true)
    .eq("users.status", "active")
    .maybeSingle();

  if (!post) notFound();
  const user = post.users as unknown as {
    id: string;
    name: string | null;
    username: string | null;
    photo_url: string | null;
  };

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [
    { data: reactionRows },
    { data: myReactionRows },
    { count: repostCount },
    myRepostResult,
    { count: shareCount },
    myCollaboration,
    { data: approvedCollaborations },
    { data: commentRows },
    { count: commentCount },
    { count: viewCount },
    { data: viewDurationRows },
    { data: sources },
  ] = await Promise.all([
    supabase.from("reactions").select("type").eq("post_id", post.id),
    authUser
      ? supabase.from("reactions").select("type").eq("post_id", post.id).eq("user_id", authUser.id)
      : Promise.resolve({ data: null as { type: string }[] | null }),
    supabase.from("reposts").select("*", { count: "exact", head: true }).eq("post_id", post.id),
    authUser
      ? supabase
          .from("reposts")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", authUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("shares").select("*", { count: "exact", head: true }).eq("post_id", post.id),
    authUser
      ? supabase
          .from("collaborations")
          .select("id,status")
          .eq("post_id", post.id)
          .eq("requester_id", authUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; status: string } | null }),
    supabase
      .from("collaborations")
      .select("id,admin_approved_at,requester:users!collaborations_requester_id_fkey(name,username)")
      .eq("post_id", post.id)
      .eq("status", "admin_approved")
      .order("admin_approved_at", { ascending: true }),
    supabase
      .from("comments")
      .select("id,post_id,user_id,parent_id,body,deleted,created_at,updated_at,user:users(id,name,username,photo_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true }),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id).eq("deleted", false),
    supabase.from("post_views").select("*", { count: "exact", head: true }).eq("post_id", post.id),
    supabase
      .from("post_views")
      .select("duration_seconds")
      .eq("post_id", post.id)
      .not("duration_seconds", "is", null),
    supabase
      .from("sources")
      .select("id,url,quote,image_url,image_caption,source_label")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true }),
  ]);
  const hasReposted = !!myRepostResult.data;
  const hasRequestedCollaboration = !!myCollaboration.data;

  const initialCounts: Record<ReactionTypeKey, number> = {
    learned: 0,
    researched: 0,
    followup_question: 0,
  };
  for (const r of reactionRows ?? []) {
    if (isReactionType(r.type)) {
      initialCounts[r.type] += 1;
    }
  }

  const initialActive: Record<ReactionTypeKey, boolean> = {
    learned: false,
    researched: false,
    followup_question: false,
  };
  for (const r of myReactionRows ?? []) {
    if (isReactionType(r.type)) {
      initialActive[r.type] = true;
    }
  }
  const averageDurationSeconds =
    (viewDurationRows ?? []).length > 0
      ? Math.round(
          (viewDurationRows ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0) /
            (viewDurationRows ?? []).length,
        )
      : null;
  const readTimeLabel = estimateReadTimeLabel(post.body_md ?? "");
  const plainDescription = descriptionFromMarkdown(post.body_md ?? "");
  const canonicalUrl = absoluteUrl(`/u/${username}/${slug}`);
  const firstImage = (sources ?? []).find((s) => !!s.image_url)?.image_url ?? DEFAULT_OG_IMAGE;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    author: {
      "@type": "Person",
      name: user.name?.trim() || user.username || "Unknown",
    },
    datePublished: post.published_at,
    dateModified: post.published_at,
    description: plainDescription,
    url: canonicalUrl,
    image: firstImage,
  };

  return (
    <article className="card max-w-4xl space-y-8 p-8 md:p-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <PostViewTracker postId={post.id} />
      <div className="border-b border-border pb-6">
        <p className="text-sm text-muted">
          By{" "}
          <Link href={`/u/${user.username}`} className="font-semibold text-primary hover:underline">
            {user.name}
          </Link>{" "}
          · {new Date(post.published_at).toLocaleString()} · 👁️ {viewCount ?? 0} views · {readTimeLabel}
          {averageDurationSeconds != null ? ` · avg ${averageDurationSeconds}s viewed` : ""}
        </p>
        {(approvedCollaborations ?? []).map((c) => {
          const requesterRaw = c.requester as
            | { name: string | null; username: string | null }
            | Array<{ name: string | null; username: string | null }>
            | null;
          const requester = Array.isArray(requesterRaw) ? requesterRaw[0] : requesterRaw;
          const coAuthorName = requester?.name?.trim() || requester?.username || "Unknown";
          return (
            <p key={c.id} className="mt-2 text-sm text-muted">
              Co-authored with <span className="font-semibold text-foreground">{coAuthorName}</span> on{" "}
              {c.admin_approved_at ? new Date(c.admin_approved_at).toLocaleDateString() : "—"}
            </p>
          );
        })}
      </div>
      <div className="prose max-w-none">
        <PostMarkdown>{post.body_md}</PostMarkdown>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1">
            <PostReactions
              postId={post.id}
              isLoggedIn={!!authUser}
              initialCounts={initialCounts}
              initialActive={initialActive}
            />
            {!!authUser && authUser.id !== user.id ? (
              hasRequestedCollaboration ? (
                <span className="mt-4 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  Collaboration requested
                </span>
              ) : (
                <form action={requestCollaborationAction} className="mt-4">
                  <input type="hidden" name="postId" value={post.id} />
                  <button type="submit" className="btn-secondary-sm">
                    Request to collaborate
                  </button>
                </form>
              )
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-end lg:flex-col lg:items-end">
            <PostRepostControls
              postId={post.id}
              isLoggedIn={!!authUser}
              isAuthor={!!authUser && authUser.id === user.id}
              initialCount={repostCount ?? 0}
              hasReposted={hasReposted}
            />
            <PostShareControls
              postId={post.id}
              postTitle={post.title}
              initialShareCount={shareCount ?? 0}
              isLoggedIn={!!authUser}
            />
          </div>
        </div>
      </div>

      <PostComments
        postId={post.id}
        comments={(commentRows ?? []).map((row) => {
          const userRaw = row.user as
            | { id: string; name: string | null; username: string | null; photo_url: string | null }
            | Array<{ id: string; name: string | null; username: string | null; photo_url: string | null }>
            | null;
          const userValue = Array.isArray(userRaw) ? userRaw[0] ?? null : userRaw;
          return {
            id: row.id as string,
            post_id: row.post_id as string,
            user_id: row.user_id as string,
            parent_id: row.parent_id as string | null,
            body: row.body as string,
            deleted: row.deleted as boolean,
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
            user: userValue,
          };
        })}
        totalCount={commentCount ?? 0}
        isLoggedIn={!!authUser}
        currentUserId={authUser?.id ?? null}
        isPostAuthor={!!authUser && authUser.id === user.id}
      />

      {(sources?.length ?? 0) > 0 ? (
        <section className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground">Citations</h2>
          <ul className="mt-4 space-y-4">
            {(sources ?? []).map((s) => (
              <li key={s.id} className="text-sm leading-relaxed text-muted">
                {s.source_label ? (
                  <p className="font-medium text-foreground">{s.source_label}</p>
                ) : null}
                {s.url ? (
                  <p>
                    <a href={s.url} className="break-all text-primary underline hover:text-primary-hover" target="_blank" rel="noreferrer">
                      {s.url}
                    </a>
                  </p>
                ) : null}
                {s.quote ? <p className="mt-1 italic">{s.quote}</p> : null}
                {s.image_url ? (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image_url} alt="" className="max-h-48 max-w-full rounded border border-border object-contain" />
                    {s.image_caption ? <p className="mt-1">{s.image_caption}</p> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
