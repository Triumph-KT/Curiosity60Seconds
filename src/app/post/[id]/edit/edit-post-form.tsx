"use client";

import { useFormStatus } from "react-dom";
import { updatePostAction } from "@/app/actions";

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

export function EditPostForm(props: { postId: string; title: string; bodyMd: string }) {
  return (
    <form action={updatePostAction} className="relative grid gap-4">
      <FormPendingOverlay message="Saving your post..." />
      <input type="hidden" name="postId" value={props.postId} />
      <input name="title" defaultValue={props.title} className="input-field" required />
      <textarea
        name="body_md"
        defaultValue={props.bodyMd}
        className="input-field min-h-[320px] font-mono text-sm"
        rows={16}
        required
      />
      <SubmitButton label="Republish" />
    </form>
  );
}
