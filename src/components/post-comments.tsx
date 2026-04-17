"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
  reportCommentAction,
} from "@/app/actions";

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    photo_url: string | null;
  } | null;
};

export function PostComments({
  postId,
  comments,
  totalCount,
  isLoggedIn,
  currentUserId,
  isPostAuthor,
}: {
  postId: string;
  comments: CommentRow[];
  totalCount: number;
  isLoggedIn: boolean;
  currentUserId: string | null;
  isPostAuthor: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const arr = map.get(c.parent_id) ?? [];
      arr.push(c);
      map.set(c.parent_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [comments]);

  const topLevel = useMemo(
    () =>
      comments
        .filter((c) => !c.parent_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  async function submitNewComment() {
    if (!newComment.trim()) return;
    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("body", newComment.trim());
    setError(null);
    startTransition(async () => {
      try {
        await addCommentAction(fd);
        setNewComment("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not post comment.");
      }
    });
  }

  function renderComment(comment: CommentRow, depth = 0) {
    const replies = childrenByParent.get(comment.id) ?? [];
    const displayName = comment.user?.name?.trim() || comment.user?.username || "Unknown";
    const profileHref = comment.user?.username ? `/u/${comment.user.username}` : null;
    const initial = (displayName || "?").charAt(0).toUpperCase();
    const canEdit = !!currentUserId && comment.user_id === currentUserId && !comment.deleted;
    const canDelete =
      !comment.deleted &&
      !!currentUserId &&
      (comment.user_id === currentUserId || isPostAuthor);

    return (
      <div key={comment.id} className={`space-y-3 ${depth > 0 ? "ml-6 border-l border-border pl-4" : ""}`}>
        <div className="flex gap-3">
          {comment.user?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.user.photo_url} alt="" className="mt-0.5 h-8 w-8 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {profileHref ? (
                <Link href={profileHref} className="font-semibold text-primary hover:underline">
                  {displayName}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{displayName}</span>
              )}
              <span className="text-muted">· {new Date(comment.created_at).toLocaleString()}</span>
            </div>

            {comment.deleted ? (
              <p className="italic text-muted">This comment was deleted</p>
            ) : editingId === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  className="input-field min-h-[88px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary-sm"
                    disabled={pending || !editingBody.trim()}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("commentId", comment.id);
                      fd.set("body", editingBody.trim());
                      setError(null);
                      startTransition(async () => {
                        try {
                          await editCommentAction(fd);
                          setEditingId(null);
                          setEditingBody("");
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not edit comment.");
                        }
                      });
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    onClick={() => {
                      setEditingId(null);
                      setEditingBody("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-foreground">{comment.body}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {!comment.deleted && isLoggedIn ? (
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => {
                    setReplyTo(replyTo === comment.id ? null : comment.id);
                    setReplyBody("");
                  }}
                >
                  Reply
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditingBody(comment.body);
                  }}
                >
                  Edit
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="btn-destructive text-xs"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("commentId", comment.id);
                    setError(null);
                    startTransition(async () => {
                      try {
                        await deleteCommentAction(fd);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not delete comment.");
                      }
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
              {!comment.deleted && isLoggedIn ? (
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => {
                    setReportingId(reportingId === comment.id ? null : comment.id);
                    setReportReason("");
                  }}
                >
                  Report
                </button>
              ) : null}
            </div>

            {replyTo === comment.id ? (
              <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  className="input-field min-h-[72px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary-sm"
                    disabled={pending || !replyBody.trim()}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("postId", postId);
                      fd.set("parentId", comment.id);
                      fd.set("body", replyBody.trim());
                      setError(null);
                      startTransition(async () => {
                        try {
                          await addCommentAction(fd);
                          setReplyTo(null);
                          setReplyBody("");
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not post reply.");
                        }
                      });
                    }}
                  >
                    Post reply
                  </button>
                  <button type="button" className="btn-secondary-sm" onClick={() => setReplyTo(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {reportingId === comment.id ? (
              <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Optional reason for reporting..."
                  className="input-field min-h-[72px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary-sm"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("commentId", comment.id);
                      fd.set("reason", reportReason.trim());
                      setError(null);
                      startTransition(async () => {
                        try {
                          await reportCommentAction(fd);
                          setReportingId(null);
                          setReportReason("");
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not report comment.");
                        }
                      });
                    }}
                  >
                    Submit report
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    onClick={() => {
                      setReportingId(null);
                      setReportReason("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {replies.length > 0 ? <div className="space-y-3">{replies.map((r) => renderComment(r, depth + 1))}</div> : null}
      </div>
    );
  }

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-lg font-semibold text-foreground">💬 Comments ({totalCount})</h2>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <div className="space-y-4">{topLevel.map((c) => renderComment(c))}</div>
      {isLoggedIn ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <label className="text-sm font-medium text-foreground" htmlFor="new-comment">
            Add a comment
          </label>
          <textarea
            id="new-comment"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="input-field min-h-[96px]"
          />
          <button
            type="button"
            className="btn-primary-sm"
            disabled={pending || !newComment.trim()}
            onClick={submitNewComment}
          >
            Post comment
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-medium text-primary underline hover:text-primary-hover">
            Sign in to comment
          </Link>
        </p>
      )}
    </section>
  );
}
