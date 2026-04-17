import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/data";
import { MessagesClient } from "./messages-client";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const raw = typeof sp.c === "string" ? sp.c.trim() : "";
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const initialConversationId = uuidRe.test(raw) ? raw : null;

  return (
    <div className="-mx-6 -my-10 min-h-[calc(100vh-9rem)] px-2 py-2 sm:px-0 sm:py-0">
      <MessagesClient
        key={initialConversationId ?? "inbox"}
        initialConversationId={initialConversationId}
        userId={user.id}
      />
    </div>
  );
}
