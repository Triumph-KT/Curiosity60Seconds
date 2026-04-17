"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleReactionAction } from "@/app/actions";
import { REACTION_TYPE_KEYS, type ReactionTypeKey } from "@/lib/reactions";

const DEF: Record<
  ReactionTypeKey,
  { emoji: string; label: string; title: string }
> = {
  learned: {
    emoji: "✍️",
    label: "Learned",
    title: "Counts how many people learned from this post",
  },
  researched: {
    emoji: "🔍",
    label: "Researched This Too",
    title: "Counts how many people researched the same topic",
  },
  followup_question: {
    emoji: "❓",
    label: "Follow-up Question",
    title: "Counts how many people have a follow-up question",
  },
};

export function PostReactions({
  postId,
  isLoggedIn,
  initialCounts,
  initialActive,
}: {
  postId: string;
  isLoggedIn: boolean;
  initialCounts: Record<ReactionTypeKey, number>;
  initialActive: Record<ReactionTypeKey, boolean>;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCounts(initialCounts);
    setActive(initialActive);
  }, [
    postId,
    initialCounts.learned,
    initialCounts.researched,
    initialCounts.followup_question,
    initialActive.learned,
    initialActive.researched,
    initialActive.followup_question,
  ]);

  function handleToggle(type: ReactionTypeKey) {
    const wasActive = active[type];
    const prevCount = counts[type];
    setActive((a) => ({ ...a, [type]: !wasActive }));
    setCounts((c) => ({
      ...c,
      [type]: wasActive ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("postId", postId);
        fd.set("reactionType", type);
        await toggleReactionAction(fd);
      } catch {
        setActive((a) => ({ ...a, [type]: wasActive }));
        setCounts((c) => ({ ...c, [type]: prevCount }));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Reactions</h2>
      <div className="flex flex-wrap gap-2">
        {REACTION_TYPE_KEYS.map((type) => {
          const cfg = DEF[type];
          const n = counts[type];
          const isOn = active[type];
          const base =
            "inline-flex min-h-[2.5rem] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors";
          const idle = "border-border bg-surface text-foreground hover:bg-canvas";
          const activeStyle =
            "border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-400/60 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/50";

          if (!isLoggedIn) {
            return (
              <Link
                key={type}
                href="/login"
                title={cfg.title}
                className={`${base} ${idle}`}
              >
                <span aria-hidden>{cfg.emoji}</span>
                <span>{cfg.label}</span>
                <span className="tabular-nums text-muted">— {n}</span>
              </Link>
            );
          }

          return (
            <button
              key={type}
              type="button"
              title={cfg.title}
              disabled={pending}
              onClick={() => handleToggle(type)}
              className={`${base} ${isOn ? activeStyle : idle} disabled:opacity-60`}
            >
              <span aria-hidden>{cfg.emoji}</span>
              <span>{cfg.label}</span>
              <span className="tabular-nums text-muted">— {n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
