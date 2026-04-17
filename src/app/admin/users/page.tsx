import { redirect } from "next/navigation";
import {
  deleteUserAction,
  demoteFromAdminAction,
  promoteToAdminAction,
  restoreUserAction,
  suspendUserAction,
} from "@/app/actions";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePageParam, rangeForPage, totalPagesForCount } from "@/lib/pagination";
import { requireAdminUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const currentAdmin = await requireAdminUser();
  const sp = await searchParams;
  const page = parsePageParam(sp.page);
  const { from, to } = rangeForPage(page, PAGE_SIZE);

  const service = await createSupabaseServiceClient();
  const { data: users, count } = await service
    .from("users")
    .select("id,email,name,username,role,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = totalPagesForCount(count, PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (page !== safePage) {
    redirect(`/admin/users?page=${safePage}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="mt-2 text-muted">Manage accounts, roles, and status.</p>
      </div>
      <section className="card divide-y divide-border p-2 md:p-4">
        {(users ?? []).map((user) => {
          const statusClass =
            user.status === "active"
              ? "font-medium text-emerald-700"
              : user.status === "suspended"
                ? "font-medium text-amber-700"
                : user.status === "deleted"
                  ? "font-medium text-red-700"
                  : "font-medium text-muted";

          return (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm first:pt-2 last:pb-2"
            >
              <p className="text-foreground">
                {user.name} ({user.email}){" "}
                <span className={statusClass}>— status: {user.status}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {user.role === "user" ? (
                  <form action={promoteToAdminAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="btn-primary-sm">
                      Promote to Admin
                    </button>
                  </form>
                ) : null}
                {user.role === "admin" && user.id !== currentAdmin.id ? (
                  <form action={demoteFromAdminAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="btn-secondary-sm border-primary text-primary hover:bg-primary/5">
                      Demote from Admin
                    </button>
                  </form>
                ) : null}
                {user.status === "active" ? (
                  <>
                    <form action={suspendUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Suspend
                      </button>
                    </form>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="btn-destructive text-xs">
                        Delete
                      </button>
                    </form>
                  </>
                ) : user.status === "suspended" ? (
                  <>
                    <form action={restoreUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                      >
                        Restore
                      </button>
                    </form>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="btn-destructive text-xs">
                        Delete
                      </button>
                    </form>
                  </>
                ) : user.status === "deleted" ? (
                  <form action={restoreUserAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      Restore
                    </button>
                  </form>
                ) : (
                  <>
                    <form action={suspendUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Suspend
                      </button>
                    </form>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="btn-destructive text-xs">
                        Delete
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </section>
      <PaginationControls basePath="/admin/users" page={safePage} totalPages={totalPages} />
    </div>
  );
}
