"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { EventModal } from "@/components/calendar/EventModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
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

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export default function CalendarPage() {
  const { member } = useCurrentMember();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(dateKey(new Date()));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const rangeStart = weekStart;
    const rangeEnd = addDays(weekStart, 7);

    const [{ data: eventRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .gte("starts_at", rangeStart.toISOString())
        .lt("starts_at", rangeEnd.toISOString())
        .order("starts_at"),
      supabase.from("family_members").select("*").order("sort_order"),
    ]);

    setEvents((eventRows ?? []) as CalendarEvent[]);
    setMembers((memberRows ?? []) as FamilyMember[]);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dateKey(new Date(event.starts_at));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  function openCreateModal(day: Date) {
    setSelectedEvent(null);
    setModalDefaultDate(dateKey(day));
    setModalOpen(true);
  }

  function openEditModal(event: CalendarEvent) {
    setSelectedEvent(event);
    setModalDefaultDate(dateKey(new Date(event.starts_at)));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedEvent(null);
  }

  function handleSaved() {
    closeModal();
    fetchData();
  }

  function handleDeleted() {
    closeModal();
    fetchData();
  }

  const today = new Date();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/calendar/photo-import"
            className="text-sm text-neutral-500 hover:underline"
          >
            Add via photo
          </Link>
          <button
            type="button"
            onClick={() => openCreateModal(today)}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + New event
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Next
          </button>
        </div>
        <span className="text-sm font-medium text-neutral-700">{formatWeekRange(weekStart)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-2">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === dateKey(today);
            return (
              <section
                key={key}
                className="rounded-xl border border-neutral-200 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2
                    className={`font-medium ${isToday ? "text-neutral-900" : "text-neutral-700"}`}
                  >
                    {DAY_LABELS[day.getDay()]}{" "}
                    <span className={isToday ? "text-neutral-900" : "text-neutral-400"}>
                      {day.getDate()}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openCreateModal(day)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                    title="Add event on this day"
                  >
                    +
                  </button>
                </div>

                {dayEvents.length === 0 ? (
                  <p className="text-xs text-neutral-400">No events</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayEvents.map((event) => {
                      const assignedMember = event.assigned_member_id
                        ? memberById.get(event.assigned_member_id)
                        : null;
                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => openEditModal(event)}
                            className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-left hover:bg-neutral-50"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: assignedMember?.color ?? "#a3a3a3" }}
                              />
                              <span className="truncate text-sm font-medium text-neutral-900">
                                {event.title}
                              </span>
                            </div>
                            <span className="text-xs text-neutral-500">
                              {event.all_day
                                ? "All day"
                                : new Date(event.starts_at).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <EventModal
          members={members}
          currentMemberId={member?.id ?? null}
          event={selectedEvent}
          defaultDate={modalDefaultDate}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
