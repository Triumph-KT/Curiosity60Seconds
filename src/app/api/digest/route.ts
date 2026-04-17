import { NextRequest, NextResponse } from "next/server";
import { buildUserDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/email";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const secret = process.env.DIGEST_SECRET;
  const headerSecret = request.headers.get("x-digest-secret");
  if (!secret || !headerSecret || headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createSupabaseServiceClient();
  const thresholdIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: users, error } = await service
    .from("users")
    .select("id,email,name,username,last_digest_sent_at,status")
    .eq("status", "active")
    .not("email", "is", null)
    .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${thresholdIso}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const user of users ?? []) {
    if (!user.email) continue;
    const digest = await buildUserDigest(service, {
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    });

    await sendEmail({
      to: user.email,
      subject: digest.subject,
      html: digest.html,
    });

    await service
      .from("users")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("id", user.id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
