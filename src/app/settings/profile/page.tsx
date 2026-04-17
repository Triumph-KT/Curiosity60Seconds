import { updateProfileSettingsAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";

export default async function SettingsProfilePage() {
  const user = await requireActiveAppUser();
  const displayName = user.name ?? "Your profile";
  const initial = (user.name ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Profile settings</h1>
        <p className="mt-2 text-muted">Update your public profile and username.</p>
      </div>
      <form action={updateProfileSettingsAction} className="card grid gap-5 p-8 md:p-10">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-canvas p-5 sm:flex-row sm:items-start">
          {user.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photo_url}
              alt={displayName}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {initial}
            </div>
          )}
          <div className="grid flex-1 gap-2">
            <p className="font-semibold text-foreground">Profile photo</p>
            <input name="photo" type="file" accept="image/*" className="input-field py-2 text-sm file:mr-3" />
            <p className="text-xs text-muted">Use a clear square image (JPEG or PNG, around 1MB or less).</p>
            <label className="mt-1 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="removePhoto" className="h-3 w-3 rounded border-border" />
              <span>Remove current photo</span>
            </label>
          </div>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Name</span>
          <input name="name" defaultValue={user.name ?? ""} className="input-field" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Username</span>
          <input name="username" defaultValue={user.username ?? ""} className="input-field" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Bio</span>
          <textarea name="bio" defaultValue={user.bio ?? ""} className="input-field min-h-[88px]" rows={3} />
        </label>
        <button type="submit" className="btn-primary w-fit">
          Save profile
        </button>
      </form>
    </div>
  );
}
