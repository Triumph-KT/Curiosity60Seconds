import Link from "next/link";
import { redirect } from "next/navigation";
import {
  adminDeleteReportedMessageAction,
  adminDismissMessageReportAction,
  deleteCommentAction,
  dismissCommentReportAction,
} from "@/app/actions";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const service = await createSupabaseServiceClient();
  const { data: rows, count } = await service
    .from("posts")
    .select("id,title,slug,status,user_id,created_at,updated_at,published_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/admin/content?page=${safePage}`);
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const { data: owners } = userIds.length
    ? await service.from("users").select("id,email,username").in("id", userIds)
    : { data: [] };
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));
  const { data: reportedComments } = await service
    .from("comments")
    .select("id,body,post_id,user_id,updated_at,deleted")
    .eq("reported", true)
    .order("updated_at", { ascending: false })
    .limit(100);
  const reportedPostIds = Array.from(new Set((reportedComments ?? []).map((c) => c.post_id)));
  const reportedCommenterIds = Array.from(new Set((reportedComments ?? []).map((c) => c.user_id)));
  const { data: reportedPosts } = reportedPostIds.length
    ? await service.from("posts").select("id,title,slug,user_id").in("id", reportedPostIds)
    : { data: [] as Array<{ id: string; title: string; slug: string; user_id: string }> };
  const { data: reportedCommenters } = reportedCommenterIds.length
    ? await service.from("users").select("id,name,username").in("id", reportedCommenterIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const { data: reports } = (reportedComments ?? []).length
    ? await service
        .from("comment_reports")
        .select("id,comment_id,reporter_id,reason,created_at")
        .in("comment_id", (reportedComments ?? []).map((c) => c.id))
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ id: string; comment_id: string; reporter_id: string; reason: string | null; created_at: string }> };
  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id)));
  const { data: reporters } = reporterIds.length
    ? await service.from("users").select("id,name,username").in("id", reporterIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const reportedPostById = new Map((reportedPosts ?? []).map((p) => [p.id, p]));
  const commenterById = new Map((reportedCommenters ?? []).map((u) => [u.id, u]));
  const reporterById = new Map((reporters ?? []).map((u) => [u.id, u]));
  const latestReportByCommentId = new Map<
    string,
    { id: string; comment_id: string; reporter_id: string; reason: string | null; created_at: string }
  >();
  for (const r of reports ?? []) {
    if (!latestReportByCommentId.has(r.comment_id)) latestReportByCommentId.set(r.comment_id, r);
  }

  const { data: reportedMessages } = await service
    .from("messages")
    .select("id,body,type,post_id,conversation_id,sender_id,created_at,reported")
    .eq("reported", true)
    .order("created_at", { ascending: false })
    .limit(100);
  const reportedMsgIds = (reportedMessages ?? []).map((m) => m.id);
  const { data: msgReports } = reportedMsgIds.length
    ? await service
        .from("message_reports")
        .select("id,message_id,reporter_id,reason,created_at")
        .in("message_id", reportedMsgIds)
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ id: string; message_id: string; reporter_id: string; reason: string | null; created_at: string }> };
  const latestReportByMessageId = new Map<
    string,
    { id: string; message_id: string; reporter_id: string; reason: string | null; created_at: string }
  >();
  for (const r of msgReports ?? []) {
    if (!latestReportByMessageId.has(r.message_id)) latestReportByMessageId.set(r.message_id, r);
  }
  const reportedSenderIds = Array.from(new Set((reportedMessages ?? []).map((m) => m.sender_id)));
  const reportedMsgReporterIds = Array.from(new Set((msgReports ?? []).map((r) => r.reporter_id)));
  const { data: reportedSenders } = reportedSenderIds.length
    ? await service.from("users").select("id,name,username,email").in("id", reportedSenderIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null; email: string }> };
  const { data: msgReporters } = reportedMsgReporterIds.length
    ? await service.from("users").select("id,name,username").in("id", reportedMsgReporterIds)
    : { data: [] as Array<{ id: string; name: string | null; username: string | null }> };
  const reportedSenderById = new Map((reportedSenders ?? []).map((u) => [u.id, u]));
  const msgReporterById = new Map((msgReporters ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Content</h1>
        <p className="mt-2 text-muted">All posts across the platform.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-canvas">
            <tr>
              <th className="p-4 font-semibold text-foreground">Title</th>
              <th className="p-4 font-semibold text-foreground">Status</th>
              <th className="p-4 font-semibold text-foreground">Author</th>
              <th className="p-4 font-semibold text-foreground">Updated</th>
              <th className="p-4 font-semibold text-foreground">Link</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((post) => {
              const owner = ownerById.get(post.user_id);
              return (
                <tr key={post.id} className="border-t border-border">
                  <td className="p-4 font-medium text-foreground">{post.title}</td>
                  <td className="p-4 text-muted">{post.status}</td>
                  <td className="p-4 text-muted">{owner?.email ?? post.user_id}</td>
                  <td className="p-4 text-muted">{new Date(post.updated_at).toLocaleString()}</td>
                  <td className="p-4">
                    {owner?.username ? (
                      <Link
                        href={`/u/${owner.username}/${post.slug}`}
                        className="font-medium text-primary underline hover:text-primary-hover"
                      >
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Reported messages</h2>
        {(reportedMessages ?? []).length === 0 ? (
          <div className="card p-6 text-sm text-muted">No reported messages.</div>
        ) : (
          <div className="card divide-y divide-border p-2 md:p-4">
            {(reportedMessages ?? []).map((msg) => {
              const sender = reportedSenderById.get(msg.sender_id);
              const report = latestReportByMessageId.get(msg.id);
              const reporter = report ? msgReporterById.get(report.reporter_id) : null;
              const senderName = sender?.name?.trim() || sender?.username || sender?.email || msg.sender_id;
              const reporterName = reporter?.name?.trim() || reporter?.username || "Unknown reporter";
              const preview =
                msg.type === "post_share"
                  ? `Post share${msg.post_id ? ` (post ${msg.post_id})` : ""}`
                  : (msg.body ?? "").slice(0, 400) || "(empty)";
              return (
                <div key={msg.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-2 last:pb-2">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-medium text-foreground">{preview}</p>
                    <p className="text-muted">Type: {msg.type}</p>
                    <p className="text-muted">Conversation: {msg.conversation_id}</p>
                    <p className="text-muted">Sender: {senderName}</p>
                    <p className="text-muted">Reporter: {reporterName}</p>
                    {report?.reason ? <p className="text-muted">Reason: {report.reason}</p> : null}
                    <Link
                      href={`/messages?c=${msg.conversation_id}`}
                      className="font-medium text-primary underline hover:text-primary-hover"
                    >
                      Open in messages
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={adminDeleteReportedMessageAction}>
                      <input type="hidden" name="messageId" value={msg.id} />
                      <button type="submit" className="btn-destructive text-xs">
                        Delete
                      </button>
                    </form>
                    <form action={adminDismissMessageReportAction}>
                      <input type="hidden" name="messageId" value={msg.id} />
                      <button type="submit" className="btn-secondary-sm">
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Reported comments</h2>
        {(reportedComments ?? []).length === 0 ? (
          <div className="card p-6 text-sm text-muted">No reported comments.</div>
        ) : (
          <div className="card divide-y divide-border p-2 md:p-4">
            {(reportedComments ?? []).map((comment) => {
              const post = reportedPostById.get(comment.post_id);
              const commenter = commenterById.get(comment.user_id);
              const report = latestReportByCommentId.get(comment.id);
              const reporter = report ? reporterById.get(report.reporter_id) : null;
              const postOwner = post ? ownerById.get(post.user_id) : null;
              const postHref = postOwner?.username && post?.slug ? `/u/${postOwner.username}/${post.slug}` : null;
              const reporterName = reporter?.name?.trim() || reporter?.username || "Unknown reporter";
              const commenterName = commenter?.name?.trim() || commenter?.username || "Unknown commenter";
              return (
                <div key={comment.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-2 last:pb-2">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-medium text-foreground">{comment.deleted ? "This comment was deleted" : comment.body}</p>
                    <p className="text-muted">On post: {post?.title ?? "Unknown post"}</p>
                    <p className="text-muted">Commenter: {commenterName}</p>
                    <p className="text-muted">Reporter: {reporterName}</p>
                    {report?.reason ? <p className="text-muted">Reason: {report.reason}</p> : null}
                    {postHref ? (
                      <Link href={postHref} className="font-medium text-primary underline hover:text-primary-hover">
                        View post
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={deleteCommentAction}>
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button type="submit" className="btn-destructive text-xs">
                        Delete comment
                      </button>
                    </form>
                    <form action={dismissCommentReportAction}>
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button type="submit" className="btn-secondary-sm">
                        Dismiss report
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <PaginationControls basePath="/admin/content" page={safePage} totalPages={totalPages} />
    </div>
  );
}
