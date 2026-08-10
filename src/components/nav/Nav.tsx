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

// A single persistent left icon rail at every viewport width — narrow with
// icon+tiny label on phones, wider with a header and full labels from `sm`
// up. Mirrors the always-visible sidebar in the Skylight reference photos
// rather than swapping to a bottom tab bar on mobile.
export function Nav({ badgeCounts = {} }: { badgeCounts?: Partial<Record<BadgeModule, number>> }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-[72px] shrink-0 flex-col gap-1 border-r border-accent-200/60 bg-white/70 p-2 sm:w-56 sm:p-4">
      <div className="mb-2 hidden px-2 font-serif text-base font-semibold leading-tight text-accent-900 sm:mb-4 sm:block">
        {APP_NAME}
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const count = item.module !== "home" ? badgeCounts[item.module] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-sm ${
              active
                ? "bg-accent-600 text-white shadow-sm"
                : "text-accent-900/80 hover:bg-accent-100"
            }`}
          >
            <item.Icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
            {!!count && (
              <span className="absolute right-1 top-1 rounded-full bg-sage-600 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:static sm:ml-auto">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
