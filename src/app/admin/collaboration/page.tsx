import Link from "next/link";
import { adminApproveCollaborationAction, rejectCollaborationAction } from "@/app/actions";
import { requireAdminUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export default async function AdminCollaborationPage() {
  await requireAdminUser();
  const service = await createSupabaseServiceClient();

  const { data: rows } = await service
    .from("collaborations")
    .select("id,post_id,requester_id,requested_at,author_approved_at")
    .eq("status", "author_approved")
    .order("author_approved_at", { ascending: true });

  const postIds = Array.from(new Set((rows ?? []).map((r) => r.post_id)));
  const requesterIds = Array.from(new Set((rows ?? []).map((r) => r.requester_id)));

  const [{ data: posts }, { data: requesters }] = await Promise.all([
    postIds.length
      ? service.from("posts").select("id,title,user_id,slug").in("id", postIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; user_id: string; slug: string }> }),
    requesterIds.length
      ? service.from("users").select("id,name,username").in("id", requesterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; username: string | null }> }),
  ]);

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.user_id)));
  const { data: authors } = authorIds.length
    ? await service.from("users").select("id,name,username").in("id", authorIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };

  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const requesterById = new Map((requesters ?? []).map((u) => [u.id, u]));
  const authorById = new Map((authors ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Collaborations</h1>
        <p className="mt-2 text-muted">Author-approved collaboration requests awaiting admin approval.</p>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="card p-8 text-center text-muted">No collaboration requests are waiting for review.</div>
      ) : (
        <section className="card divide-y divide-border p-2 md:p-4">
          {(rows ?? []).map((row) => {
            const post = postById.get(row.post_id);
            const requester = requesterById.get(row.requester_id);
            const author = post ? authorById.get(post.user_id) : null;
            const requesterName = requester?.name?.trim() || requester?.username || "Unknown requester";
            const authorName = author?.name?.trim() || author?.username || "Unknown author";
            const postHref = author?.username && post?.slug ? `/u/${author.username}/${post.slug}` : null;

            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm first:pt-2 last:pb-2"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{post?.title ?? "Untitled post"}</p>
                  <p className="text-muted">
                    Requester: <span className="text-foreground">{requesterName}</span>
                  </p>
                  <p className="text-muted">
                    Author: <span className="text-foreground">{authorName}</span>
                  </p>
                  {postHref ? (
                    <Link href={postHref} className="font-medium text-primary underline hover:text-primary-hover">
                      View post
                    </Link>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <form action={adminApproveCollaborationAction}>
                    <input type="hidden" name="collaborationId" value={row.id} />
                    <button type="submit" className="btn-primary-sm">
                      Approve
                    </button>
                  </form>
                  <form action={rejectCollaborationAction}>
                    <input type="hidden" name="collaborationId" value={row.id} />
                    <button type="submit" className="btn-destructive text-xs">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
