"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/stats", label: "Stats" },
  { href: "/settings/voice", label: "Voice" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/danger", label: "Danger" },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 md:w-56">
      <nav className="card flex flex-col gap-1 p-3 text-sm">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Settings</p>
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 font-medium transition-colors ${
                active ? "bg-primary text-white shadow-sm" : "text-foreground hover:bg-canvas"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
