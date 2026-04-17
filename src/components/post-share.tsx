"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { searchShareableUsersAction, sharePostAction, type ShareableUserRow } from "@/app/actions";

export function PostShareControls({
  postId,
  postTitle,
  initialShareCount,
  isLoggedIn,
}: {
  postId: string;
  postTitle: string;
  initialShareCount: number;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ShareableUserRow[]>([]);
  const [selected, setSelected] = useState<Map<string, ShareableUserRow>>(new Map());
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    setShareCount(initialShareCount);
  }, [postId, initialShareCount]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setResults([]);
      return;
    }
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchShareableUsersAction(debouncedQuery)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setSelected(new Map());
    setSuccessText(null);
    setSendError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  function toggleUser(u: ShareableUserRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(u.id)) next.delete(u.id);
      else next.set(u.id, u);
      return next;
    });
  }

  function sendShare() {
    const ids = Array.from(selected.keys());
    if (ids.length === 0) return;
    startTransition(async () => {
      setSendError(null);
      try {
        const n = await sharePostAction(postId, ids);
        setShareCount((c) => c + n);
        setSuccessText(`Shared with ${n} people`);
        setSelected(new Map());
        setQuery("");
        setDebouncedQuery("");
        setResults([]);
        window.setTimeout(() => {
          closeModal();
        }, 1400);
      } catch (e) {
        setSendError(e instanceof Error ? e.message : "Could not share.");
      }
    });
  }

  const countLabel = (
    <span className="text-sm text-muted">
      Shares{" "}
      <span className="tabular-nums font-semibold text-foreground">{shareCount}</span>
    </span>
  );

  if (!isLoggedIn) {
    return <div>{countLabel}</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {countLabel}
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary-sm">
        Share
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-post-title"
            className="card max-h-[85vh] w-full max-w-lg overflow-hidden shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-5 py-4">
              <h2 id="share-post-title" className="text-lg font-semibold text-foreground">
                Share post
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{postTitle}</p>
            </div>

            {successText ? (
              <div className="px-5 py-10 text-center text-sm font-medium text-primary">{successText}</div>
            ) : (
              <>
                <div className="space-y-3 px-5 py-4">
                  <label className="block text-sm font-medium text-foreground" htmlFor="share-search">
                    Find people
                  </label>
                  <input
                    id="share-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or username…"
                    className="input-field"
                    autoComplete="off"
                  />
                  {selected.size > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selected.values()).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-2 py-1 text-xs font-medium text-foreground hover:bg-surface"
                        >
                          {u.name?.trim() || u.username || "User"}
                          <span aria-hidden>×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="max-h-52 overflow-y-auto border-y border-border px-2 py-2">
                  {searching ? (
                    <p className="px-3 py-6 text-center text-sm text-muted">Searching…</p>
                  ) : !debouncedQuery ? (
                    <p className="px-3 py-6 text-center text-sm text-muted">
                      Type a name or username to search everyone on the site (except you).
                    </p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>
                  ) : (
                    <ul className="space-y-1">
                      {results.map((u) => {
                        const on = selected.has(u.id);
                        const label = u.name?.trim() || u.username || "User";
                        const initial = (u.name?.trim() || u.username || "?").charAt(0).toUpperCase();
                        return (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => toggleUser(u)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                on ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-canvas"
                              }`}
                            >
                              {u.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.photo_url}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border"
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-border">
                                  {initial}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium text-foreground">{label}</span>
                                {u.username ? (
                                  <span className="block text-xs text-muted">@{u.username}</span>
                                ) : null}
                              </span>
                              <span
                                className={`shrink-0 text-xs font-semibold ${on ? "text-primary" : "text-muted"}`}
                              >
                                {on ? "Selected" : "Add"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 px-5 py-4">
                  {sendError ? (
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{sendError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={closeModal} className="btn-secondary-sm">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending || selected.size === 0}
                      onClick={sendShare}
                      className="btn-primary-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
