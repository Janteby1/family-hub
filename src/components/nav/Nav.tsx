"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BadgeModule } from "@/lib/types";

const NAV_ITEMS: { href: string; label: string; module: BadgeModule | "home" }[] = [
  { href: "/", label: "Home", module: "home" },
  { href: "/calendar", label: "Calendar", module: "calendar" },
  { href: "/tasks", label: "Tasks", module: "tasks" },
  { href: "/lists", label: "Lists", module: "lists" },
  { href: "/meals", label: "Meals", module: "meals" },
  { href: "/recipes", label: "Recipes", module: "recipes" },
  { href: "/rewards", label: "Rewards", module: "rewards" },
];

export function Nav({ badgeCounts = {} }: { badgeCounts?: Partial<Record<BadgeModule, number>> }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden w-56 flex-col gap-1 border-r border-neutral-200 bg-white p-4 md:flex">
        <div className="mb-4 px-2 text-lg font-semibold text-neutral-900">Family Hub</div>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const count = item.module !== "home" ? badgeCounts[item.module] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <span>{item.label}</span>
              {!!count && (
                <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const count = item.module !== "home" ? badgeCounts[item.module] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              <span>{item.label}</span>
              {!!count && (
                <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
