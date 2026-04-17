import { requireActiveAppUser } from "@/lib/auth";
import { SettingsSidebar } from "./settings-sidebar";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireActiveAppUser();
  return (
    <div className="flex flex-col gap-10 md:flex-row">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
