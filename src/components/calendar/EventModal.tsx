"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, FamilyMember } from "@/lib/types";

interface EventModalProps {
  members: FamilyMember[];
  currentMemberId: string | null;
  event: CalendarEvent | null; // null => create mode
  defaultDate: string; // yyyy-mm-dd, used to prefill date for a new event
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
}

export function EventModal({
  members,
  currentMemberId,
  event,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: EventModalProps) {
  const isEdit = event !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("20:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setLocation(event.location ?? "");
      setAllDay(event.all_day);
      setStartDate(toDateInputValue(event.starts_at));
      setStartTime(toTimeInputValue(event.starts_at));
      if (event.ends_at) {
        setEndDate(toDateInputValue(event.ends_at));
        setEndTime(toTimeInputValue(event.ends_at));
      } else {
        setEndDate("");
        setEndTime("");
      }
      setAssignedMemberIds(event.assigned_member_ids ?? []);
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      setStartDate(defaultDate);
      setStartTime("20:00");
      setEndDate("");
      setEndTime("");
      setAssignedMemberIds([]);
    }
    setError(null);
  }, [event, defaultDate]);

  function toggleAssignedMember(memberId: string) {
    setAssignedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const startsAt = allDay
      ? combineDateTime(startDate, "00:00")
      : combineDateTime(startDate, startTime);

    let endsAt: Date | null = null;
    if (endDate) {
      endsAt = allDay ? combineDateTime(endDate, "00:00") : combineDateTime(endDate, endTime || startTime);
      if (endsAt.getTime() < startsAt.getTime()) {
        setError("End date/time can't be before the start.");
        setSaving(false);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      all_day: allDay,
      assigned_member_ids: assignedMemberIds,
    };

    const supabase = createClient();

    if (isEdit && event) {
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", event.id);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("calendar_events").insert({
        ...payload,
        created_by: currentMemberId,
        source: "manual",
      });
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    onSaved();
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", event.id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-[var(--foreground)]">{isEdit ? "Edit event" : "New event"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-accent-900/55 hover:text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="Event title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              rows={2}
              placeholder="Optional details"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="Optional location"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            {!allDay && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">End date (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            {!allDay && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Assigned to</label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const selected = assignedMemberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleAssignedMember(member.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-transparent text-white"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                    style={selected ? { backgroundColor: member.color } : undefined}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: selected ? "rgba(255,255,255,0.8)" : member.color }}
                    />
                    {member.display_name}
                  </button>
                );
              })}
            </div>
            {assignedMemberIds.length === 0 && (
              <p className="mt-1 text-xs text-neutral-400">Unassigned</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
