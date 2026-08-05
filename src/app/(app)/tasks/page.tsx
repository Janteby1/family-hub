"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import type { ChoreInstance, ChoreTemplate, FamilyMember } from "@/lib/types";

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TasksPage() {
  useMarkModuleSeen("tasks");
  const { member: currentMember } = useCurrentMember();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [instances, setInstances] = useState<ChoreInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newUpForGrabs, setNewUpForGrabs] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const today = todayISO();

    const [{ data: membersData }, { data: templatesData }] = await Promise.all([
      supabase.from("family_members").select("*").order("sort_order"),
      supabase.from("chore_templates").select("*").eq("active", true).order("sort_order"),
    ]);

    const allMembers = (membersData ?? []) as FamilyMember[];
    const allTemplates = (templatesData ?? []) as ChoreTemplate[];

    const { data: instancesData } = await supabase
      .from("chore_instances")
      .select("*")
      .eq("occurrence_date", today);
    let allInstances = (instancesData ?? []) as ChoreInstance[];

    // Lazily backfill today's instances for any active template that doesn't
    // have one yet (stand-in for the not-yet-built cron job).
    const existingTemplateIds = new Set(allInstances.map((i) => i.template_id));
    const missing = allTemplates.filter((t) => !existingTemplateIds.has(t.id));
    if (missing.length > 0) {
      const { data: inserted } = await supabase
        .from("chore_instances")
        .insert(
          missing.map((t) => ({
            template_id: t.id,
            occurrence_date: today,
          }))
        )
        .select("*");
      if (inserted) {
        allInstances = [...allInstances, ...(inserted as ChoreInstance[])];
      }
    }

    setMembers(allMembers);
    setTemplates(allTemplates);
    setInstances(allInstances);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live sync: someone else claiming/completing a chore, or a new chore
  // template being added, shows up here without a manual refresh. Scoped to
  // today's occurrence_date since that's the only slice this page cares about.
  useRealtimeTable(
    "chore_instances",
    () => loadAll(),
    `occurrence_date=eq.${todayISO()}`
  );
  useRealtimeTable("chore_templates", () => loadAll());

  const instanceByTemplateId = useMemo(() => {
    const map = new Map<string, ChoreInstance>();
    for (const instance of instances) {
      map.set(instance.template_id, instance);
    }
    return map;
  }, [instances]);

  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  async function toggleInstance(instance: ChoreInstance, completed: boolean) {
    const patch: Partial<ChoreInstance> = completed
      ? {
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by_member_id: currentMember?.id ?? null,
        }
      : {
          completed: false,
          completed_at: null,
          completed_by_member_id: null,
        };

    setInstances((prev) =>
      prev.map((i) => (i.id === instance.id ? { ...i, ...patch } : i))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("chore_instances")
      .update(patch)
      .eq("id", instance.id);

    if (error) {
      // revert on failure
      setInstances((prev) =>
        prev.map((i) => (i.id === instance.id ? instance : i))
      );
    }
  }

  async function claimInstance(instance: ChoreInstance) {
    if (!currentMember) return;
    const patch = { claimed_by_member_id: currentMember.id };

    setInstances((prev) =>
      prev.map((i) => (i.id === instance.id ? { ...i, ...patch } : i))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("chore_instances")
      .update(patch)
      .eq("id", instance.id);

    if (error) {
      setInstances((prev) =>
        prev.map((i) => (i.id === instance.id ? instance : i))
      );
    }
  }

  async function addChore(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || saving) return;
    if (!newUpForGrabs && !newAssignee) return;

    setSaving(true);
    const supabase = createClient();

    const insertPayload = {
      title,
      assigned_member_id: newUpForGrabs ? null : newAssignee,
      is_up_for_grabs: newUpForGrabs,
      recurrence: "daily" as const,
      star_value: 1,
      active: true,
    };

    const { data: template, error } = await supabase
      .from("chore_templates")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !template) {
      setSaving(false);
      return;
    }

    const newTemplate = template as ChoreTemplate;

    const { data: instance } = await supabase
      .from("chore_instances")
      .insert({ template_id: newTemplate.id, occurrence_date: todayISO() })
      .select("*")
      .single();

    setTemplates((prev) => [...prev, newTemplate]);
    if (instance) {
      setInstances((prev) => [...prev, instance as ChoreInstance]);
    }

    setNewTitle("");
    setNewAssignee("");
    setNewUpForGrabs(false);
    setAddOpen(false);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Tasks</h1>
        <p className="text-sm text-accent-900/55">Loading…</p>
      </div>
    );
  }

  function openAddFor(memberId: string) {
    setNewUpForGrabs(false);
    setNewAssignee(memberId);
    setAddOpen(true);
  }

  const upForGrabsTemplates = templates.filter((t) => t.is_up_for_grabs);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Tasks</h1>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {addOpen ? "Cancel" : "+ Add chore"}
        </button>
      </div>

      {addOpen && (
        <form
          onSubmit={addChore}
          className="mb-6 flex flex-col gap-3 rounded-xl border border-accent-100 p-4 md:flex-row md:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-accent-900/55">
              Chore title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Feed the dog"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-accent-900/55">
              Assign to
            </label>
            <select
              value={newUpForGrabs ? "" : newAssignee}
              disabled={newUpForGrabs}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
            >
              <option value="">Select a person…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <input
              id="up-for-grabs"
              type="checkbox"
              checked={newUpForGrabs}
              onChange={(e) => {
                setNewUpForGrabs(e.target.checked);
                if (e.target.checked) setNewAssignee("");
              }}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <label htmlFor="up-for-grabs" className="text-sm text-neutral-700">
              Up for grabs
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || !newTitle.trim() || (!newUpForGrabs && !newAssignee)}
            className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const memberTemplates = templates.filter(
            (t) => t.assigned_member_id === member.id && !t.is_up_for_grabs
          );
          const rows = memberTemplates
            .map((t) => ({ template: t, instance: instanceByTemplateId.get(t.id) }))
            .filter((r) => r.instance) as { template: ChoreTemplate; instance: ChoreInstance }[];
          const done = rows.filter((r) => r.instance.completed).length;

          return (
            <section key={member.id} className="rounded-xl border border-accent-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  <h2 className="font-medium text-[var(--foreground)]">{member.display_name}</h2>
                </div>
                {rows.length > 0 && (
                  <span className="text-sm text-accent-900/55">
                    {done}/{rows.length}
                  </span>
                )}
              </div>
              {rows.length === 0 ? (
                <div className="rounded-md border border-dashed border-accent-200 p-3 text-center">
                  <p className="mb-2 text-sm text-accent-900/55">No chores yet.</p>
                  <button
                    type="button"
                    onClick={() => openAddFor(member.id)}
                    className="text-sm font-medium text-accent-600 hover:underline"
                  >
                    + Add a chore for {member.display_name}
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {rows.map(({ template, instance }) => (
                    <li key={template.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={instance.completed}
                        onChange={(e) => toggleInstance(instance, e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <span
                        className={
                          instance.completed
                            ? "text-sm text-neutral-400 line-through"
                            : "text-sm text-[var(--foreground)]"
                        }
                      >
                        {template.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Up for Grabs</h2>
          </div>
          {upForGrabsTemplates.length === 0 ? (
            <p className="text-sm text-accent-900/55">Nothing up for grabs today.</p>
          ) : (
            <ul className="space-y-2">
              {upForGrabsTemplates.map((template) => {
                const instance = instanceByTemplateId.get(template.id);
                if (!instance) return null;
                const claimedBy = instance.claimed_by_member_id
                  ? memberById.get(instance.claimed_by_member_id)
                  : null;

                if (!claimedBy) {
                  return (
                    <li key={template.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--foreground)]">{template.title}</span>
                      <button
                        type="button"
                        onClick={() => claimInstance(instance)}
                        disabled={!currentMember}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Claim
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={template.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={instance.completed}
                      onChange={(e) => toggleInstance(instance, e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    <span
                      className={
                        instance.completed
                          ? "text-sm text-neutral-400 line-through"
                          : "text-sm text-[var(--foreground)]"
                      }
                    >
                      {template.title}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-accent-900/55">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: claimedBy.color }}
                      />
                      {claimedBy.display_name}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
