import type { SupabaseClient } from "@supabase/supabase-js";

/** Permanently remove posts and soft-delete accounts whose approved deletion is older than 30 days (UTC). */
export async function runDeletionCleanups(service: SupabaseClient) {
  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await service
    .from("posts")
    .delete()
    .not("deletion_approved_at", "is", null)
    .lte("deletion_approved_at", cutoffIso);

  await service
    .from("users")
    .update({ status: "deleted" })
    .not("deletion_approved_at", "is", null)
    .lte("deletion_approved_at", cutoffIso)
    .neq("status", "deleted");
}
