import Link from "next/link";
import { adminSetupAction } from "./actions";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export default async function AdminSetupPage() {
  const service = await createSupabaseServiceClient();
  const { count } = await service
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if (count !== null && count > 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-muted">Setup already complete</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="card mx-auto max-w-xl space-y-6 p-8 md:p-10">
      <h1 className="page-title">Admin setup</h1>
      {!user ? (
        <p className="text-muted">
          Sign in with the account that should become the first admin, then return to this page.
        </p>
      ) : null}
      {user ? (
        <form action={adminSetupAction} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Setup key
            <input
              name="setupKey"
              type="password"
              className="input-field"
              required
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn-primary w-fit">
            Complete setup
          </button>
        </form>
      ) : (
        <p className="text-sm">
          <Link href="/login" className="font-medium text-primary underline hover:text-primary-hover">
            Go to login
          </Link>
        </p>
      )}
    </div>
  );
}
