"use client";

import type { FormEvent } from "react";
import {
  approveAccountDeletionAction,
  approvePostDeletionAction,
  rejectAccountDeletionAction,
  rejectPostDeletionAction,
} from "@/app/actions";

type PostRow = {
  id: string;
  title: string;
  slug: string;
  deletion_requested_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  deletion_requested_at: string;
};

function confirmApprovePost(e: FormEvent<HTMLFormElement>) {
  if (
    !window.confirm(
      "Approve permanent deletion of this post? This schedules the post for removal and cannot be undone from this screen.",
    )
  ) {
    e.preventDefault();
  }
}

function confirmRejectPost(e: FormEvent<HTMLFormElement>) {
  if (
    !window.confirm(
      "Reject this deletion request? The pending request will be cleared. The post stays in its current state (for example, unpublished until the author republishes).",
    )
  ) {
    e.preventDefault();
  }
}

function confirmApproveAccount(e: FormEvent<HTMLFormElement>) {
  if (
    !window.confirm(
      "Approve account deletion? This schedules the account for removal according to your retention policy. This action is serious and should not be confirmed by mistake.",
    )
  ) {
    e.preventDefault();
  }
}

function confirmRejectAccount(e: FormEvent<HTMLFormElement>) {
  if (
    !window.confirm(
      "Reject this account deletion request? The user will keep their account and the request will be cleared.",
    )
  ) {
    e.preventDefault();
  }
}

export function PostDeletionRequests({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return <p className="text-muted">No pending post deletion requests.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {posts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div>
            <p className="font-semibold text-foreground">{p.title}</p>
            <p className="mt-1 text-xs text-muted">
              {p.slug} · requested {new Date(p.deletion_requested_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={approvePostDeletionAction} onSubmit={confirmApprovePost}>
              <input type="hidden" name="postId" value={p.id} />
              <button type="submit" className="btn-primary-sm">
                Approve deletion
              </button>
            </form>
            <form action={rejectPostDeletionAction} onSubmit={confirmRejectPost}>
              <input type="hidden" name="postId" value={p.id} />
              <button
                type="submit"
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-canvas"
              >
                Reject request
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AccountDeletionRequests({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return <p className="text-muted">No pending account deletion requests.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {users.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div>
            <p className="font-semibold text-foreground">
              {u.name} ({u.email})
            </p>
            <p className="mt-1 text-xs text-muted">
              requested {new Date(u.deletion_requested_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={approveAccountDeletionAction} onSubmit={confirmApproveAccount}>
              <input type="hidden" name="userId" value={u.id} />
              <button type="submit" className="btn-primary-sm">
                Approve deletion
              </button>
            </form>
            <form action={rejectAccountDeletionAction} onSubmit={confirmRejectAccount}>
              <input type="hidden" name="userId" value={u.id} />
              <button
                type="submit"
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-canvas"
              >
                Reject request
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
