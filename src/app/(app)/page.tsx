import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, ChoreInstance, ChoreTemplate, FamilyMember, List, ListItem } from "@/lib/types";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: members }, { data: events }, { data: templates }, { data: instances }, { data: lists }] =
    await Promise.all([
      supabase.from("family_members").select("*").order("sort_order"),
      supabase
        .from("calendar_events")
        .select("*")
        .gte("starts_at", startOfTodayISO())
        .lte("starts_at", endOfTodayISO())
        .order("starts_at"),
      supabase.from("chore_templates").select("*").eq("active", true),
      supabase.from("chore_instances").select("*").eq("occurrence_date", today),
      supabase.from("lists").select("*").order("created_at"),
    ]);

  const familyMembers = (members ?? []) as FamilyMember[];
  const todaysEvents = (events ?? []) as CalendarEvent[];
  const choreTemplates = (templates ?? []) as ChoreTemplate[];
  const choreInstances = (instances ?? []) as ChoreInstance[];
  const allLists = (lists ?? []) as List[];

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

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Today</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Calendar</h2>
            <Link href="/calendar" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          {todaysEvents.length === 0 ? (
            <p className="text-sm text-accent-900/55">No events today.</p>
          ) : (
            <ul className="space-y-2">
              {todaysEvents.map((event) => {
                const member = event.assigned_member_id ? memberById.get(event.assigned_member_id) : null;
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
                        : new Date(event.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Today&apos;s tasks</h2>
            <Link href="/tasks" className="text-sm text-accent-900/55 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {familyMembers.map((member) => {
              const memberTemplates = choreTemplates.filter((t) => t.assigned_member_id === member.id);
              const memberInstances = choreInstances.filter((i) =>
                memberTemplates.some((t) => t.id === i.template_id)
              );
              const done = memberInstances.filter((i) => i.completed).length;
              const total = memberTemplates.length;
              if (total === 0) return null;
              return (
                <div key={member.id} className="rounded-lg border border-accent-100 p-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.color }} />
                    <span className="text-sm font-medium text-[var(--foreground)]">{member.display_name}</span>
                  </div>
                  <span className="text-xs text-accent-900/55">
                    {done}/{total} done
                  </span>
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
