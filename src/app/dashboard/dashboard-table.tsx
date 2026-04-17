"use client";

import Link from "next/link";
import {
  cancelPostDeletionAction,
  requestPostDeletionAction,
  togglePostPublishedAction,
} from "@/app/actions";

export type DashboardPostRow = {
  id: string;
  title: string;
  status: string;
  slug: string;
  view_count: number;
  updated_at: string;
  published_at: string | null;
  deletion_requested_at: string | null;
  deletion_approved_at: string | null;
};

const DELETION_WARNING =
  "Your post will be unpublished and an admin will permanently delete it within 30 days. You can cancel the request from your dashboard while it is pending.";

const CANCEL_DELETION_CONFIRM =
  "Cancel this deletion request? Your post will be published again on your profile.";

export function DashboardTable({
  posts,
  username,
}: {
  posts: DashboardPostRow[];
  username: string;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-canvas">
          <tr>
            <th className="p-4 font-semibold text-foreground">Title</th>
            <th className="p-4 font-semibold text-foreground">Status</th>
            <th className="p-4 font-semibold text-foreground">Updated</th>
            <th className="p-4 font-semibold text-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const deletionPending =
              post.deletion_requested_at != null && post.deletion_approved_at == null;
            const scheduledRemoval = post.deletion_approved_at != null;

            return (
              <tr key={post.id} className="border-t border-border">
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{post.title}</span>
                    <span className="rounded-lg bg-canvas px-2 py-0.5 text-xs text-muted">
                      👁️ {post.view_count} views
                    </span>
                    {deletionPending ? (
                      <form
                        action={cancelPostDeletionAction}
                        className="inline"
                        onSubmit={(e) => {
                          if (!window.confirm(CANCEL_DELETION_CONFIRM)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="postId" value={post.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-accent/20 px-2.5 py-1 text-xs font-medium text-foreground underline decoration-primary/50 hover:bg-accent/30"
                        >
                          Deletion pending — Cancel request
                        </button>
                      </form>
                    ) : null}
                    {scheduledRemoval ? (
                      <span className="rounded-lg bg-border px-2 py-0.5 text-xs text-muted">
                        Removal scheduled
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="p-4 text-muted">{post.status}</td>
                <td className="p-4 text-muted">{new Date(post.updated_at).toLocaleString()}</td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {post.status === "published" ? (
                      <Link
                        href={`/u/${username}/${post.slug}`}
                        className="font-medium text-primary underline hover:text-primary-hover"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-muted">View</span>
                    )}
                    <Link
                      href={`/post/${post.id}/edit`}
                      className="font-medium text-primary underline hover:text-primary-hover"
                    >
                      Edit
                    </Link>
                    <form action={togglePostPublishedAction} className="inline">
                      <input type="hidden" name="postId" value={post.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-canvas"
                      >
                        {post.status === "published" ? "Unpublish" : "Republish"}
                      </button>
                    </form>
                    {!deletionPending && !scheduledRemoval ? (
                      <form
                        action={requestPostDeletionAction}
                        className="inline"
                        onSubmit={(e) => {
                          if (!window.confirm(DELETION_WARNING)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="postId" value={post.id} />
                        <button type="submit" className="btn-destructive text-xs">
                          Request deletion
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
