"use client";

import { useFormStatus } from "react-dom";
import { generatePostAction } from "@/app/actions";

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
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-amber-950 shadow-md transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
    >
      {label}
    </button>
  );
}

export default function NewPage() {
  return (
    <div className="card mx-auto max-w-4xl space-y-8 p-8 md:p-10">
      <div className="space-y-3 text-center md:text-left">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Turn your research into a published post
        </h1>
        <p className="text-balance text-base leading-relaxed text-muted md:text-lg">
          Paste links, text, or screenshots from your research. We will generate a cited article in your voice and
          publish it instantly.
        </p>
      </div>
      <form action={generatePostAction} className="relative grid gap-4">
        <FormPendingOverlay message="Generating your post, this may take up to a minute..." />
        <input name="question" placeholder="Your question" className="input-field" required />
        <textarea
          name="rawSources"
          placeholder="Paste raw text sources"
          className="input-field min-h-[180px]"
          rows={8}
          required
        />
        <textarea name="urls" placeholder="Source URLs (one per line)" className="input-field min-h-[100px]" rows={4} />
        <textarea
          name="labels"
          placeholder="Source labels (one per line, aligns with URLs/images)"
          className="input-field min-h-[100px]"
          rows={4}
        />
        <textarea
          name="captions"
          placeholder="Image captions (one per line)"
          className="input-field min-h-[100px]"
          rows={4}
        />
        <input name="images" type="file" accept="image/*" multiple className="input-field py-2 text-sm file:mr-3" />
        <SubmitButton label="Generate and publish" />
      </form>
    </div>
  );
}
