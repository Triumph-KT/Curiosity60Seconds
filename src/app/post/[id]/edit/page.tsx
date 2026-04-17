import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAppUser } from "@/lib/auth";
import { EditPostForm } from "./edit-post-form";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveAppUser();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", id).single();
  if (!post) notFound();
  let isApprovedCollaborator = false;
  if (post.user_id !== user.id && user.role !== "admin") {
    const { data: collaboration } = await supabase
      .from("collaborations")
      .select("id")
      .eq("post_id", id)
      .eq("requester_id", user.id)
      .eq("status", "admin_approved")
      .maybeSingle();
    isApprovedCollaborator = !!collaboration;
  }
  if (post.user_id !== user.id && user.role !== "admin" && !isApprovedCollaborator) redirect("/dashboard");

  return (
    <div className="card mx-auto max-w-4xl space-y-6 p-8 md:p-10">
      <h1 className="page-title">Edit post</h1>
      <p className="text-muted">Update title and body, then republish.</p>
      <EditPostForm postId={post.id} title={post.title} bodyMd={post.body_md} />
    </div>
  );
}
