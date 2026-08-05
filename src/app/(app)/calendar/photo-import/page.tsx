"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import type { FamilyMember } from "@/lib/types";

interface ExtractedEvent {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  confidence?: "high" | "medium" | "low";
  notes?: string;
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function combineDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:image/jpeg;base64," prefix — the API wants raw base64
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoImportPage() {
  const router = useRouter();
  const { member } = useCurrentMember();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ExtractedEvent["confidence"] | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [extracted, setExtracted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("family_members")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setMembers((data ?? []) as FamilyMember[]));
  }, []);

  async function handleFileSelected(file: File) {
    setExtractError(null);
    setExtracted(false);
    setPreviewUrl(URL.createObjectURL(file));
    setExtracting(true);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/vision/extract-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "Couldn't read that photo.");
        return;
      }

      const event = data.event as ExtractedEvent;
      setTitle(event.title ?? "");
      setNotes(event.notes ?? "");
      setLocation(event.location ?? "");
      setConfidence(event.confidence ?? null);
      if (event.date) setDate(event.date);
      if (event.time) {
        setTime(event.time);
        setAllDay(false);
      } else {
        setAllDay(true);
      }
      setExtracted(true);
    } catch {
      setExtractError("Couldn't read that photo. You can still fill in the details manually below.");
    } finally {
      setExtracting(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const startsAt = allDay ? combineDateTime(date, "00:00") : combineDateTime(date, time);

    const { error } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      description: notes.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      all_day: allDay,
      assigned_member_id: assignedMemberId || null,
      created_by: member?.id ?? null,
      source: "photo_import",
    });

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }

    router.push("/calendar");
  }

  return (
    <div className="p-4 md:p-8">
      <Link href="/calendar" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        ← Back to calendar
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Add event via photo</h1>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="mb-6 max-w-2xl rounded-xl border border-dashed border-neutral-300 p-6 text-center"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected invite" className="mx-auto mb-3 max-h-64 rounded-md object-contain" />
        ) : (
          <p className="mb-3 text-sm text-neutral-500">
            Take a photo of a flyer or invite, or drop an image here.
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {extracting ? "Reading photo…" : previewUrl ? "Choose a different photo" : "Choose photo"}
        </button>
        {extractError && <p className="mt-2 text-sm text-red-600">{extractError}</p>}
      </div>

      {extracted && (
        <p className="mb-4 max-w-2xl text-sm text-amber-700">
          Extracted from the photo{confidence === "low" ? " (low confidence — please double-check)" : ""} —
          review and edit everything below before saving. Nothing is saved automatically.
        </p>
      )}

      <form onSubmit={handleSave} className="max-w-2xl space-y-4">
        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="Event title"
          />
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="Optional location"
          />
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            All day
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            {!allDay && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Assigned to</label>
          <select
            value={assignedMemberId}
            onChange={(e) => setAssignedMemberId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="Optional details"
          />
        </section>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save event"}
        </button>
      </form>
    </div>
  );
}
