"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { EventModal } from "@/components/calendar/EventModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type ViewMode = "week" | "twoWeek" | "month";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRange(rangeStart: Date, days: number): string {
  const rangeEnd = addDays(rangeStart, days - 1);
  const startLabel = rangeStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = rangeEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export default function CalendarPage() {
  useMarkModuleSeen("calendar");
  const { member } = useCurrentMember();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(dateKey(new Date()));

  // Month grid always shows 6 full weeks (42 days) starting from the Sunday
  // on or before the 1st, so partial leading/trailing days from adjacent
  // months fill the grid rather than leaving ragged edges.
  const monthGridStart = useMemo(() => startOfWeek(monthAnchor), [monthAnchor]);

  const cardDayCount = viewMode === "twoWeek" ? 14 : 7;
  const rangeStart = viewMode === "month" ? monthGridStart : weekStart;
  const rangeEnd = viewMode === "month" ? addDays(monthGridStart, 42) : addDays(weekStart, cardDayCount);

  const cardDays = useMemo(
    () => Array.from({ length: cardDayCount }, (_, i) => addDays(weekStart, i)),
    [weekStart, cardDayCount]
  );

  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)),
    [monthGridStart]
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.getTime(), rangeEnd.getTime()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live sync: any calendar_events change (on this device or another) triggers
  // a refetch of the current range. Unfiltered because postgres_changes only
  // supports simple equality filters, not the date-range this view needs.
  useRealtimeTable("calendar_events", () => {
    fetchData();
  });

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

  function goPrev() {
    if (viewMode === "month") setMonthAnchor((prev) => addMonths(prev, -1));
    else setWeekStart((prev) => addDays(prev, -cardDayCount));
  }

  function goNext() {
    if (viewMode === "month") setMonthAnchor((prev) => addMonths(prev, 1));
    else setWeekStart((prev) => addDays(prev, cardDayCount));
  }

  function goToday() {
    setWeekStart(startOfWeek(new Date()));
    setMonthAnchor(startOfMonth(new Date()));
  }

  const today = new Date();
  const rangeLabel =
    viewMode === "month"
      ? monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : formatRange(weekStart, cardDayCount);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/calendar/photo-import"
            className="text-sm text-accent-900/55 hover:underline"
          >
            Add via photo
          </Link>
          <button
            type="button"
            onClick={() => openCreateModal(today)}
            className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + New event
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} className="rounded-md border border-accent-200 px-3 py-2 text-sm font-medium text-accent-900/80 hover:bg-accent-50">
            Prev
          </button>
          <button type="button" onClick={goToday} className="rounded-md border border-accent-200 px-3 py-2 text-sm font-medium text-accent-900/80 hover:bg-accent-50">
            Today
          </button>
          <button type="button" onClick={goNext} className="rounded-md border border-accent-200 px-3 py-2 text-sm font-medium text-accent-900/80 hover:bg-accent-50">
            Next
          </button>
          <span className="ml-2 text-sm font-medium text-accent-900/80">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-accent-200 p-1">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`rounded px-3 py-1 text-sm font-medium ${
              viewMode === "week" ? "bg-accent-600 text-white" : "text-accent-900/70"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("twoWeek")}
            className={`rounded px-3 py-1 text-sm font-medium ${
              viewMode === "twoWeek" ? "bg-accent-600 text-white" : "text-accent-900/70"
            }`}
          >
            2 Weeks
          </button>
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`rounded px-3 py-1 text-sm font-medium ${
              viewMode === "month" ? "bg-accent-600 text-white" : "text-accent-900/70"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-accent-900/55">Loading...</p>
      ) : viewMode !== "month" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-2">
          {cardDays.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === dateKey(today);
            return (
              <section key={key} className="rounded-xl border border-accent-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2
                    className={`font-medium ${isToday ? "text-[var(--foreground)]" : "text-neutral-700"}`}
                  >
                    {DAY_LABELS[day.getDay()]}{" "}
                    <span className={isToday ? "text-[var(--foreground)]" : "text-neutral-400"}>
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
                            className="w-full rounded-md border border-accent-100 px-2 py-1.5 text-left hover:bg-accent-50"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: assignedMember?.color ?? "#a3a3a3" }}
                              />
                              <span className="truncate text-sm font-medium text-[var(--foreground)]">
                                {event.title}
                              </span>
                            </div>
                            <span className="text-xs text-accent-900/55">
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
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-accent-100 bg-accent-100">
            {DAY_LABELS.map((label) => (
              <div key={label} className="bg-accent-50 p-2 text-center text-xs font-medium text-accent-900/70">
                {label}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === dateKey(today);
              const inMonth = day.getMonth() === monthAnchor.getMonth();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openCreateModal(day)}
                  className={`min-h-24 p-1.5 text-left align-top ${
                    inMonth ? "bg-white" : "bg-accent-50/40"
                  } hover:bg-accent-50`}
                >
                  <span
                    className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-accent-600 text-white"
                        : inMonth
                        ? "text-[var(--foreground)]"
                        : "text-neutral-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <ul className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => {
                      const assignedMember = event.assigned_member_id
                        ? memberById.get(event.assigned_member_id)
                        : null;
                      return (
                        <li
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(event);
                          }}
                          className="flex items-center gap-1 truncate rounded px-1 text-[11px] hover:bg-accent-100"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: assignedMember?.color ?? "#a3a3a3" }}
                          />
                          <span className="truncate text-[var(--foreground)]">{event.title}</span>
                        </li>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <li className="px-1 text-[11px] text-accent-900/55">+{dayEvents.length - 3} more</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
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
