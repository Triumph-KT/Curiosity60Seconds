import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createSupabaseServiceClient>>;

export async function buildUserDigest(
  service: ServiceClient,
  params: { userId: string; email: string; name: string | null; username: string | null },
) {
  const sinceIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [{ count: newFollowers }, { count: unreadNotifications }, { count: newPosts }] = await Promise.all([
    service
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", params.userId)
      .gte("created_at", sinceIso),
    service
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .eq("read", false),
    service
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .gte("created_at", sinceIso),
  ]);

  const displayName = params.name?.trim() || params.username || "there";
  const subject = "Your 3-day Curiosity60Seconds digest";
  const html = `
    <div style="font-family: Arial, sans-serif; color:#111827; line-height:1.5;">
      <h2 style="margin:0 0 12px;">Curiosity60Seconds</h2>
      <p style="margin:0 0 12px;">Hi ${displayName}, here is your 3-day digest.</p>
      <ul style="margin:0 0 16px; padding-left:20px;">
        <li>New followers: <strong>${newFollowers ?? 0}</strong></li>
        <li>Unread notifications: <strong>${unreadNotifications ?? 0}</strong></li>
        <li>Posts created by you: <strong>${newPosts ?? 0}</strong></li>
      </ul>
      <p style="margin:0 0 16px;">
        <a href="${appUrl}/dashboard" style="color:#1b4332; font-weight:600;">Open your dashboard</a>
      </p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;" />
      <p style="margin:0; font-size:12px; color:#6b7280;">
        You are receiving this because you have an account on Curiosity60Seconds.
      </p>
    </div>
  `;

  return { subject, html };
}
