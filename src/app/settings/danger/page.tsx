import { cancelAccountDeletionAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";
import { AccountDeletionForm } from "../account-deletion-form";

export default async function SettingsDangerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountDeletion?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireActiveAppUser();
  const accountDeletionPending =
    user.deletion_requested_at != null && user.deletion_approved_at == null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Danger zone</h1>
        <p className="mt-2 text-muted">Irreversible account actions.</p>
      </div>

      {accountDeletionPending ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900"
          role="status"
        >
          <p className="mb-4 leading-relaxed">
            Your account deletion request is pending admin review. You can cancel while pending.
          </p>
          <form action={cancelAccountDeletionAction}>
            <button type="submit" className="btn-secondary">
              Cancel request
            </button>
          </form>
        </div>
      ) : null}

      {sp.accountDeletion === "requested" ? (
        <div className="rounded-xl border border-border bg-canvas p-4 text-sm text-foreground" role="status">
          Your account deletion request has been submitted and is awaiting admin review.
        </div>
      ) : null}

      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">Request account deletion</h2>
        <p className="mt-2 text-sm leading-relaxed text-red-800">
          This action starts the account deletion workflow and may remove your content permanently after
          approval. Please confirm carefully.
        </p>
        <AccountDeletionForm />
      </div>
    </div>
  );
}
