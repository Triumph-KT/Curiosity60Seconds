import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log("messages/unread getUser", {
    userId: userData.user?.id ?? null,
    hasUser: !!userData.user,
    error: userError?.message ?? null,
  });
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ count: 0 });
  }
  const { data, error } = await supabase.rpc("unread_message_count");
  if (error) {
    console.error("unread_message_count", error);
    return NextResponse.json({ count: 0 });
  }
  return NextResponse.json({ count: typeof data === "number" ? data : 0 });
}
