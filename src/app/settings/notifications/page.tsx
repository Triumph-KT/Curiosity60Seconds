import { updateNotificationPreferencesAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsNotificationsPage() {
  const user = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select(
      "notify_reactions,notify_comments,notify_replies,notify_follows,notify_reposts,notify_shares,notify_messages,notify_collaborations,notify_system",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Notification preferences</h1>
        <p className="mt-2 text-muted">Choose which updates you want to receive.</p>
      </div>
      <form action={updateNotificationPreferencesAction} className="card grid gap-4 p-8 md:p-10">
        {[
          ["notify_reactions", "Reactions on your posts"],
          ["notify_comments", "Comments on your posts"],
          ["notify_replies", "Replies to your comments"],
          ["notify_follows", "New followers"],
          ["notify_reposts", "Reposts of your posts"],
          ["notify_shares", "Shares sent to you"],
          ["notify_messages", "Direct messages"],
          ["notify_collaborations", "Collaboration requests and approvals"],
          ["notify_system", "System notifications"],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">{label}</span>
            <input
              type="checkbox"
              name={key}
              defaultChecked={(prefs?.[key as keyof typeof prefs] as boolean | undefined) ?? true}
              className="h-4 w-4 rounded border-border"
            />
          </label>
        ))}
        <button type="submit" className="btn-primary w-fit">
          Save notification preferences
        </button>
      </form>
    </div>
  );
}
