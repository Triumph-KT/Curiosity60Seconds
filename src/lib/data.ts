import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function getCurrentAppUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle<AppUser>();
  return data;
}

export function estimateReadTimeLabel(bodyMd: string): string {
  const wordCount = bodyMd
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = wordCount / 200;
  if (minutes < 1) return "under 1 min read";
  return `${Math.ceil(minutes)} min read`;
}

export function getPostRankScore(params: {
  publishedAt: string | null;
  totalViews: number;
  uniqueViewers: number;
  avgDurationSeconds: number;
  reactionCount: number;
  commentCount: number;
  repostCount: number;
}) {
  const publishedMs = params.publishedAt ? new Date(params.publishedAt).getTime() : Date.now();
  const ageHours = Math.max(1, (Date.now() - publishedMs) / 36e5);
  const recencyScore = 1 / Math.pow(ageHours, 0.35);
  const engagement =
    params.totalViews * 0.08 +
    params.uniqueViewers * 0.2 +
    params.avgDurationSeconds * 0.01 +
    params.reactionCount * 1.2 +
    params.commentCount * 1.8 +
    params.repostCount * 2.2;
  return recencyScore + engagement;
}
