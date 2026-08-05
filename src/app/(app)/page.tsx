import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarEvent,
  ChoreInstance,
  ChoreTemplate,
  FamilyMember,
  List,
  ListItem,
  MealPlanEntry,
  MealSlot,
  Recipe,
} from "@/lib/types";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Today through the end of this week (Saturday), inclusive.
function restOfWeekDays(): Date[] {
  const today = startOfToday();
  const daysLeftInWeek = 6 - today.getDay();
  return Array.from({ length: daysLeftInWeek + 1 }, (_, i) => addDays(today, i));
}

function dayLabel(day: Date, todayKey: string): string {
  return dateKey(day) === todayKey
    ? "Today"
    : day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const weekDays = restOfWeekDays();
  const todayKey = dateKey(weekDays[0]);
  const rangeStartISO = weekDays[0].toISOString();
  const rangeEndISO = addDays(weekDays[weekDays.length - 1], 1).toISOString();
  const rangeStartDate = dateKey(weekDays[0]);
  const rangeEndDate = dateKey(weekDays[weekDays.length - 1]);

  const [
    { data: members },
    { data: events },
    { data: templates },
    { data: instances },
    { data: lists },
    { data: mealEntries },
    { data: recipeRows },
  ] = await Promise.all([
    supabase.from("family_members").select("*").order("sort_order"),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", rangeStartISO)
      .lt("starts_at", rangeEndISO)
      .order("starts_at"),
    supabase.from("chore_templates").select("*").eq("active", true),
    supabase.from("chore_instances").select("*").eq("occurrence_date", todayKey),
    supabase.from("lists").select("*").order("created_at"),
    supabase
      .from("meal_plan_entries")
      .select("*")
      .gte("plan_date", rangeStartDate)
      .lte("plan_date", rangeEndDate),
    supabase.from("recipes").select("id, title"),
  ]);

  const familyMembers = (members ?? []) as FamilyMember[];
  const weekEvents = (events ?? []) as CalendarEvent[];
  const choreTemplates = (templates ?? []) as ChoreTemplate[];
  const choreInstances = (instances ?? []) as ChoreInstance[];
  const allLists = (lists ?? []) as List[];
  const mealPlanEntries = (mealEntries ?? []) as MealPlanEntry[];
  const recipes = (recipeRows ?? []) as Recipe[];

  const listItemsByList: Record<string, ListItem[]> = {};
  if (allLists.length > 0) {
    const { data: items } = await supabase
      .from("list_items")
      .select("*")
      .in("list_id", allLists.map((l) => l.id))
      .eq("checked", false)
      .order("created_at");
    for (const item of (items ?? []) as ListItem[]) {
      (listItemsByList[item.list_id] ??= []).push(item);
    }
  }

  const memberById = new Map(familyMembers.map((m) => [m.id, m]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of weekEvents) {
    const key = dateKey(new Date(event.starts_at));
    (eventsByDay.get(key) ?? eventsByDay.set(key, []).get(key)!).push(event);
  }

  const mealsByDay = new Map<string, MealPlanEntry[]>();
  for (const entry of mealPlanEntries) {
    (mealsByDay.get(entry.plan_date) ?? mealsByDay.set(entry.plan_date, []).get(entry.plan_date)!).push(
      entry
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Today</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Calendar this week</h2>
            <Link href="/calendar" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          {weekEvents.length === 0 ? (
            <p className="text-sm text-accent-900/55">No events this week.</p>
          ) : (
            <div className="space-y-3">
              {weekDays.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDay.get(key);
                if (!dayEvents || dayEvents.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="mb-1 text-xs font-medium text-accent-900/55">
                      {dayLabel(day, todayKey)}
                    </p>
                    <ul className="space-y-1.5">
                      {dayEvents.map((event) => {
                        const member = event.assigned_member_id
                          ? memberById.get(event.assigned_member_id)
                          : null;
                        return (
                          <li key={event.id} className="flex items-center gap-2 text-sm">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: member?.color ?? "#a3a3a3" }}
                            />
                            <span className="font-medium text-[var(--foreground)]">{event.title}</span>
                            <span className="text-accent-900/55">
                              {event.all_day
                                ? "All day"
                                : new Date(event.starts_at).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Meals this week</h2>
            <Link href="/meals" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          {mealPlanEntries.length === 0 ? (
            <p className="text-sm text-accent-900/55">No meals planned this week.</p>
          ) : (
            <div className="space-y-3">
              {weekDays.map((day) => {
                const key = dateKey(day);
                const dayMeals = mealsByDay.get(key);
                if (!dayMeals || dayMeals.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="mb-1 text-xs font-medium text-accent-900/55">
                      {dayLabel(day, todayKey)}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {dayMeals.map((entry) => {
                        const label = entry.recipe_id
                          ? recipeById.get(entry.recipe_id)?.title ?? entry.free_text
                          : entry.free_text;
                        if (!label) return null;
                        return (
                          <li key={entry.id} className="flex gap-2">
                            <span className="text-accent-900/55">{SLOT_LABELS[entry.meal_slot]}:</span>
                            <span className="text-[var(--foreground)]">{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-accent-100 p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Today&apos;s tasks</h2>
            <Link href="/tasks" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {familyMembers.map((member) => {
              const memberTemplates = choreTemplates.filter(
                (t) => t.assigned_member_id === member.id && !t.is_up_for_grabs
              );
              const rows = memberTemplates
                .map((t) => ({
                  template: t,
                  instance: choreInstances.find((i) => i.template_id === t.id),
                }))
                .filter((r) => r.instance) as { template: ChoreTemplate; instance: ChoreInstance }[];
              if (rows.length === 0) return null;
              return (
                <div key={member.id} className="rounded-lg border border-accent-100 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.color }} />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {member.display_name}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {rows.map(({ template, instance }) => (
                      <li
                        key={template.id}
                        className={
                          instance.completed
                            ? "text-xs text-neutral-400 line-through"
                            : "text-xs text-accent-900/80"
                        }
                      >
                        {instance.completed ? "✓ " : ""}
                        {template.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-accent-100 p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Lists</h2>
            <Link href="/lists" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allLists.map((list) => {
              const items = listItemsByList[list.id] ?? [];
              return (
                <div key={list.id} className="rounded-lg border border-accent-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{list.name}</span>
                    <span className="text-xs text-accent-900/55">{items.length} left</span>
                  </div>
                  <ul className="space-y-1">
                    {items.slice(0, 4).map((item) => (
                      <li key={item.id} className="truncate text-xs text-neutral-600">
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
