import Link from "next/link";
import { redirect } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireActiveAppUser } from "@/lib/auth";
import { runDeletionCleanups } from "@/lib/deletion-cleanup";
import { DashboardTable, type DashboardPostRow } from "./dashboard-table";

const PAGE_SIZE = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireActiveAppUser();
  if (!user.onboarded) redirect("/onboarding");

  const service = await createSupabaseServiceClient();
  await runDeletionCleanups(service);

  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const supabase = await createSupabaseServerClient();
  const { count: publishedCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "published");

  const { data: posts, count } = await supabase
    .from("posts")
    .select(
      "id,title,status,published_at,updated_at,slug,deletion_requested_at,deletion_approved_at",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(from, to);
  const postIds = (posts ?? []).map((p) => p.id);
  const { data: viewRows } = postIds.length
    ? await supabase.from("post_views").select("post_id").in("post_id", postIds)
    : { data: [] as Array<{ post_id: string }> };
  const viewCountByPost = new Map<string, number>();
  for (const row of viewRows ?? []) {
    viewCountByPost.set(row.post_id, (viewCountByPost.get(row.post_id) ?? 0) + 1);
  }

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/dashboard?page=${safePage}`);
  }

  if (!user.username) {
    return (
      <div className="card p-8">
        <p className="text-muted">Set a username in onboarding to manage posts.</p>
      </div>
    );
  }

  const hasPublishedPosts = (publishedCount ?? 0) > 0;

  if (!hasPublishedPosts) {
    return (
      <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="max-w-xl text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          What did you learn today?
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-muted md:text-xl">
          Paste your sources and we will write it for you in 60 seconds
        </p>
        <Link
          href="/new"
          className="inline-flex w-full max-w-md items-center justify-center rounded-xl bg-amber-500 px-8 py-4 text-lg font-bold text-amber-950 shadow-lg transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
        >
          Create your first post
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-muted">Your posts and publishing controls.</p>
        </div>
        <Link href="/new" className="btn-accent shrink-0 text-center">
          New post
        </Link>
      </div>
      <DashboardTable
        posts={(posts ?? []).map((p) => ({
          ...(p as DashboardPostRow),
          view_count: viewCountByPost.get(p.id) ?? 0,
        }))}
        username={user.username}
      />
      <PaginationControls basePath="/dashboard" page={safePage} totalPages={totalPages} />
    </div>
  );
}
