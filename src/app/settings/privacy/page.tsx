import { updatePrivacySettingsAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPrivacyPage() {
  const user = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("users").select("show_online_status").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Privacy</h1>
        <p className="mt-2 text-muted">Control what other users can see about your activity.</p>
      </div>
      <form
        action={async (formData) => {
          "use server";
          await updatePrivacySettingsAction(formData.get("show_online_status") === "on");
        }}
        className="card grid gap-4 p-8 md:p-10"
      >
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">Show my online status to others</span>
          <input
            type="checkbox"
            name="show_online_status"
            defaultChecked={data?.show_online_status ?? true}
            className="h-4 w-4 rounded border-border"
          />
        </label>
        <button type="submit" className="btn-primary w-fit">
          Save privacy settings
        </button>
      </form>
    </div>
  );
}
