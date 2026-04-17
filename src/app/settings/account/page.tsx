import { updateAccountCredentialsAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";

export default async function SettingsAccountPage() {
  const user = await requireActiveAppUser();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Account settings</h1>
        <p className="mt-2 text-muted">Manage your sign-in credentials and account connections.</p>
      </div>
      <form action={updateAccountCredentialsAction} className="card grid gap-5 p-8 md:p-10">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input name="email" type="email" defaultValue={user.email} className="input-field" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">New password</span>
          <input
            name="newPassword"
            type="password"
            className="input-field"
            placeholder="Leave blank to keep current password"
          />
        </label>
        <button type="submit" className="btn-primary w-fit">
          Save account settings
        </button>
      </form>

      <div className="card p-8 md:p-10">
        <h2 className="text-lg font-semibold text-foreground">Connected accounts</h2>
        <p className="mt-2 text-sm text-muted">
          External account linking will be available soon.
        </p>
      </div>
    </div>
  );
}
