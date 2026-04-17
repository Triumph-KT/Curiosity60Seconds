"use client";

import { useFormStatus } from "react-dom";
import { onboardingAction } from "@/app/actions";

function FormPendingOverlay({ message }: { message: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div
      aria-live="polite"
      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/90 p-6 backdrop-blur-sm"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span
          className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary disabled:cursor-not-allowed">
      {label}
    </button>
  );
}

export default function OnboardingPage() {
  return (
    <div className="card mx-auto max-w-3xl space-y-6 p-8 md:p-10">
      <h1 className="page-title">Set up your profile</h1>
      <p className="text-muted">
        Tell us how you write—we use this to shape your voice for every generated post.
      </p>
      <form action={onboardingAction} className="relative grid gap-4">
        <FormPendingOverlay message="Setting up your writing profile..." />
        <input name="name" placeholder="Display name" className="input-field" required />
        <input name="username" placeholder="Username" className="input-field" required />
        <textarea name="bio" placeholder="Short bio" className="input-field min-h-[88px]" rows={3} />
        <input name="photo" type="file" accept="image/*" className="input-field py-2 text-sm file:mr-3" />
        <textarea name="sample1" placeholder="Writing sample 1" className="input-field min-h-[100px]" rows={4} required />
        <textarea name="sample2" placeholder="Writing sample 2" className="input-field min-h-[100px]" rows={4} required />
        <textarea name="sample3" placeholder="Writing sample 3" className="input-field min-h-[100px]" rows={4} required />
        <textarea
          name="preferences"
          placeholder="Tone, topics, and writing preferences"
          className="input-field min-h-[88px]"
          rows={3}
          required
        />
        <SubmitButton label="Finish onboarding" />
      </form>
    </div>
  );
}
