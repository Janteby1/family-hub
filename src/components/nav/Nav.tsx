"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/app-name";
import type { BadgeModule } from "@/lib/types";
import {
  HomeIcon,
  CalendarIcon,
  TasksIcon,
  ListsIcon,
  MealsIcon,
  RecipesIcon,
  RewardsIcon,
} from "@/components/nav/icons";

const NAV_ITEMS: {
  href: string;
  label: string;
  module: BadgeModule | "home";
  Icon: (props: { className?: string }) => React.ReactElement;
}[] = [
  { href: "/", label: "Home", module: "home", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", module: "calendar", Icon: CalendarIcon },
  { href: "/tasks", label: "Tasks", module: "tasks", Icon: TasksIcon },
  { href: "/lists", label: "Lists", module: "lists", Icon: ListsIcon },
  { href: "/meals", label: "Meals", module: "meals", Icon: MealsIcon },
  { href: "/recipes", label: "Recipes", module: "recipes", Icon: RecipesIcon },
  { href: "/rewards", label: "Rewards", module: "rewards", Icon: RewardsIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Phones get an app-style bottom tab bar (thumb-reachable, respects the iOS
// home-indicator safe area); tablets and desktops keep the persistent
// left sidebar.
export function Nav({ badgeCounts = {} }: { badgeCounts?: Partial<Record<BadgeModule, number>> }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 self-start overflow-y-auto border-r border-accent-200/60 bg-white/70 p-4 md:flex">
        <div className="mb-4 px-2 font-serif text-base font-semibold leading-tight text-accent-900">
          {APP_NAME}
        </div>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const count = item.module !== "home" ? badgeCounts[item.module] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-600 text-white shadow-sm"
                  : "text-accent-900/80 hover:bg-accent-100"
              }`}
            >
              <item.Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
              {!!count && (
                <span className="ml-auto rounded-full bg-sage-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-accent-200/60 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const count = item.module !== "home" ? badgeCounts[item.module] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-medium transition-colors active:bg-accent-50 ${
                active ? "text-accent-600" : "text-neutral-500"
              }`}
            >
              <span className="relative">
                <item.Icon className={`h-6 w-6 ${active ? "stroke-[2.25]" : ""}`} />
                {!!count && (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-sage-600 px-1 text-center text-[9px] font-semibold leading-4 text-white">
                    {count}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
