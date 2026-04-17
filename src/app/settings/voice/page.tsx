import { regenerateVoicePromptAction, updateVoiceSettingsAction } from "@/app/actions";
import { requireActiveAppUser } from "@/lib/auth";

export default async function SettingsVoicePage() {
  const user = await requireActiveAppUser();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">Voice settings</h1>
        <p className="mt-2 text-muted">
          Shape your writing voice by providing representative samples and guidance.
        </p>
      </div>

      <form action={updateVoiceSettingsAction} className="card grid gap-5 p-8 md:p-10">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Writing sample 1</span>
          <span className="text-xs text-muted">A piece that best represents your default tone and structure.</span>
          <textarea
            name="sample1"
            defaultValue={user.writing_samples?.[0] ?? ""}
            className="input-field min-h-[100px]"
            rows={4}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Writing sample 2</span>
          <span className="text-xs text-muted">A contrasting sample (e.g., analytical, narrative, or concise).</span>
          <textarea
            name="sample2"
            defaultValue={user.writing_samples?.[1] ?? ""}
            className="input-field min-h-[100px]"
            rows={4}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Writing sample 3</span>
          <span className="text-xs text-muted">A sample that highlights preferred word choice and cadence.</span>
          <textarea
            name="sample3"
            defaultValue={user.writing_samples?.[2] ?? ""}
            className="input-field min-h-[100px]"
            rows={4}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Voice preferences</span>
          <span className="text-xs text-muted">Describe style constraints, audience, or formatting preferences.</span>
          <textarea
            name="preferences"
            defaultValue={user.preferences ?? ""}
            className="input-field min-h-[88px]"
            rows={3}
            required
          />
        </label>
        <button type="submit" className="btn-primary w-fit">
          Save voice settings
        </button>
      </form>

      <div className="card grid gap-4 p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Generated voice prompt</h2>
          <form action={regenerateVoicePromptAction}>
            <button type="submit" className="btn-secondary-sm">
              Regenerate voice
            </button>
          </form>
        </div>
        <textarea
          value={user.voice_prompt ?? "No voice prompt generated yet."}
          className="input-field min-h-[140px]"
          readOnly
        />
      </div>
    </div>
  );
}
