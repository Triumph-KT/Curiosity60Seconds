"use client";

import { requestAccountDeletionAction } from "@/app/actions";

export function AccountDeletionForm() {
  return (
    <form
      action={requestAccountDeletionAction}
      className="mt-4"
      onSubmit={(e) => {
        if (
          !window.confirm(
            "This will notify your admin and begin the account deletion process. Continue?",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-destructive">
        Request account deletion
      </button>
    </form>
  );
}
