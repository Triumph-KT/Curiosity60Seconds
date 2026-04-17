"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: Array<{ href: string; label: string; badge?: boolean }> = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/alerts", label: "Alerts", badge: true },
  { href: "/admin/deletion-requests", label: "Deletion Requests" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/collaboration", label: "Collaborations" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export function AdminSidebar({ unresolvedCount }: { unresolvedCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 md:w-56">
      <nav className="card flex flex-col gap-1 p-3 text-sm">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Admin</p>
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 font-medium transition-colors ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-foreground hover:bg-canvas"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && unresolvedCount > 0 ? (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${
                    active ? "bg-accent text-foreground" : "bg-red-600 text-white"
                  }`}
                >
                  {unresolvedCount > 99 ? "99+" : unresolvedCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
