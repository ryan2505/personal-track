"use client";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  ListChecks,
  Compass,
  MoreHorizontal,
  Settings,
  Share2,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type Route =
  | "/today"
  | "/dashboard"
  | "/calendar"
  | "/goals"
  | "/habits"
  | "/vision"
  | "/analytics"
  | "/share"
  | "/settings";

const NAV: { href: Route; label: string; icon: typeof CheckCircle2 }[] = [
  { href: "/today", label: "Today", icon: CheckCircle2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/goals", label: "Objectifs", icon: Target },
  { href: "/habits", label: "Habitudes", icon: ListChecks },
  { href: "/vision", label: "Vision", icon: Compass },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/share", label: "Partager", icon: Share2 },
  { href: "/settings", label: "Réglages", icon: Settings },
];

// Mobile : 4 items maximum. Une bottom bar à 7 items est inutilisable.
const PRIMARY: Route[] = ["/today", "/calendar", "/goals"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = NAV.filter((item) => PRIMARY.includes(item.href));
  const secondary = NAV.filter((item) => !PRIMARY.includes(item.href));

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border hidden w-56 shrink-0 border-r px-3 py-6 lg:block">
        <p className="text-faint px-3 pb-6 text-xs tracking-[0.18em] uppercase">Personal OS</p>
        <nav className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</div>

      <nav className="border-border bg-bg/95 fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t backdrop-blur lg:hidden">
        {primary.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "text-accent" : "text-muted",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="text-muted flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]"
        >
          <MoreHorizontal className="size-5" />
          Plus
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Navigation">
        <div className="space-y-1">
          {secondary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="text-muted hover:bg-surface-2 hover:text-text flex items-center gap-3 rounded-md px-3 py-3 text-sm"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-medium">{title}</h1>
        {subtitle !== undefined && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
