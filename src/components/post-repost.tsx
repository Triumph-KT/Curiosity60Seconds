"use client";

import { useEffect, useState, useTransition } from "react";
import { repostAction, undoRepostAction } from "@/app/actions";

export function PostRepostControls({
  postId,
  isLoggedIn,
  isAuthor,
  initialCount,
  hasReposted,
}: {
  postId: string;
  isLoggedIn: boolean;
  isAuthor: boolean;
  initialCount: number;
  hasReposted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [reposted, setReposted] = useState(hasReposted);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCount(initialCount);
    setReposted(hasReposted);
  }, [postId, initialCount, hasReposted]);

  const countLabel = (
    <span className="text-sm text-muted">
      Reposts{" "}
      <span className="tabular-nums font-semibold text-foreground">{count}</span>
    </span>
  );

  if (isAuthor || !isLoggedIn) {
    return <div>{countLabel}</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {countLabel}
      {reposted ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const prevCount = count;
            const prevReposted = reposted;
            setReposted(false);
            setCount((c) => Math.max(0, c - 1));
            startTransition(async () => {
              try {
                const fd = new FormData();
                fd.set("postId", postId);
                await undoRepostAction(fd);
              } catch {
                setReposted(prevReposted);
                setCount(prevCount);
              }
            });
          }}
          className="btn-secondary-sm border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-400/60 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/50"
        >
          Undo repost
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const prevCount = count;
            const prevReposted = reposted;
            setReposted(true);
            setCount((c) => c + 1);
            startTransition(async () => {
              try {
                const fd = new FormData();
                fd.set("postId", postId);
                await repostAction(fd);
              } catch {
                setReposted(prevReposted);
                setCount(prevCount);
              }
            });
          }}
          className="btn-primary-sm"
        >
          Repost
        </button>
      )}
    </div>
  );
}
