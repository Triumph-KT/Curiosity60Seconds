"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function adminSetupAction(formData: FormData) {
  const setupKey = String(formData.get("setupKey") ?? "").trim();
  const expected = process.env.ADMIN_SETUP_KEY;
  if (!expected) {
    throw new Error("ADMIN_SETUP_KEY is not configured on the server.");
  }
  if (setupKey !== expected) {
    throw new Error("Invalid setup key.");
  }

  const service = await createSupabaseServiceClient();
  const { count, error: countError } = await service
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if (countError) throw new Error(countError.message);
  if (count !== null && count > 0) {
    throw new Error("Setup already complete.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to complete setup.");
  }

  const { error: updateError } = await service.from("users").update({ role: "admin" }).eq("id", user.id);
  if (updateError) throw new Error(updateError.message);

  redirect("/admin/overview");
}
