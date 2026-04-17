import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AccountDeletionRequests, PostDeletionRequests } from "./deletion-request-actions";

export default async function AdminDeletionRequestsPage() {
  const service = await createSupabaseServiceClient();

  const [{ data: posts }, { data: users }] = await Promise.all([
    service
      .from("posts")
      .select("id,title,slug,user_id,status,deletion_requested_at,deletion_approved_at")
      .not("deletion_requested_at", "is", null)
      .is("deletion_approved_at", null)
      .order("deletion_requested_at", { ascending: false }),
    service
      .from("users")
      .select("id,email,name,deletion_requested_at,deletion_approved_at")
      .not("deletion_requested_at", "is", null)
      .is("deletion_approved_at", null)
      .order("deletion_requested_at", { ascending: false }),
  ]);

  const postRows =
    (posts ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      deletion_requested_at: p.deletion_requested_at!,
    })) ?? [];

  const userRows =
    (users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      deletion_requested_at: u.deletion_requested_at!,
    })) ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Deletion requests</h1>
        <p className="mt-2 text-muted">Approve or reject pending post and account removals.</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Posts</h2>
        <div className="card p-4 text-sm md:p-6">
          <PostDeletionRequests posts={postRows} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Accounts</h2>
        <div className="card p-4 text-sm md:p-6">
          <AccountDeletionRequests users={userRows} />
        </div>
      </section>
    </div>
  );
}
