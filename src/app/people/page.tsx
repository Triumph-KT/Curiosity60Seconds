import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { followUserAction, unfollowUserAction } from "@/app/actions";
import { absoluteUrl } from "@/lib/seo";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Explore People — Curiosity60Seconds",
  description: "Discover curious minds publishing their research and insights",
  alternates: {
    canonical: absoluteUrl("/people"),
  },
  openGraph: {
    title: "Explore People — Curiosity60Seconds",
    description: "Discover curious minds publishing their research and insights",
    url: absoluteUrl("/people"),
    type: "website",
  },
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: users, count } = await supabase
    .from("users")
    .select("id,username,name,photo_url,bio", { count: "exact" })
    .eq("onboarded", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, to);

  const userIds = (users ?? []).map((u) => u.id);
  let followingIds = new Set<string>();
  if (authUser && userIds.length > 0) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", authUser.id)
      .in("following_id", userIds);
    followingIds = new Set((followRows ?? []).map((r) => r.following_id));
  }

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/people?page=${safePage}`);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">People</h1>
        <p className="mt-2 max-w-2xl text-muted">Discover writers and their public profiles.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {(users ?? []).map((user) => {
          const isSelf = authUser?.id === user.id;
          const isFollowing = followingIds.has(user.id);
          return (
            <div
              key={user.id}
              className="card flex flex-col gap-4 p-6 transition hover:shadow-md sm:flex-row sm:items-start sm:justify-between"
            >
              <Link href={`/u/${user.username}`} className="group min-w-0 flex-1">
                <p className="text-lg font-semibold text-foreground group-hover:text-primary">{user.name}</p>
                <p className="text-sm text-muted">@{user.username}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{user.bio}</p>
              </Link>
              {authUser && !isSelf ? (
                <form
                  action={isFollowing ? unfollowUserAction : followUserAction}
                  className="shrink-0 sm:pt-0.5"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className={isFollowing ? "btn-secondary-sm" : "btn-primary-sm"}
                  >
                    {isFollowing ? "Unfollow" : "Follow"}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
      <PaginationControls basePath="/people" page={safePage} totalPages={totalPages} />
    </div>
  );
}
