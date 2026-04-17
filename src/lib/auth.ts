import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/data";
import type { AppUser } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireActiveAppUser() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (appUser.status !== "active") redirect("/login");
  return appUser;
}

export async function requireAdminUser(): Promise<AppUser> {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (appUser.role !== "admin") redirect("/dashboard");
  return appUser;
}
