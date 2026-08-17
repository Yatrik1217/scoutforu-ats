"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Briefcase, Clock, LayoutGrid, Rows3, Table2 } from "lucide-react";
import { hexA } from "@/lib/domain";
import type { PipelineStage } from "@/lib/pipeline";
import { Avatar, RecBadge, RatingChip } from "@/components/bits";
import { useShell } from "@/components/shell-provider";
import { UserPlus } from "lucide-react";
import { moveCandidateStage } from "@/lib/actions/mutations";
import type { EnrichedCandidate } from "@/lib/data";

type Layout = "board" | "compact" | "table";

export function PipelineClient({
  candidates,
  jobs,
  recruiters,
  query,
  defaultStages,
  clientStages,
}: {
  candidates: EnrichedCandidate[];
  jobs: { id: string; title: string; clientId: string | null }[];
  recruiters: string[];
  query: string;
  defaultStages: PipelineStage[];
  clientStages: Record<string, PipelineStage[]>;
}) {
  const router = useRouter();
  const { openDrawer, canWrite, openCandidateForm, role } = useShell();
  const [items, setItems] = useState(candidates);
  const [filterJob, setFilterJob] = useState("all");
  const [filterRec, setFilterRec] = useState("all");
  const [layout, setLayout] = useState<Layout>("board");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync local board state when fresh server data arrives (after a move /
  // realtime update). Intentional state-sync with an external system.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(candidates), [candidates]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((c) => {
        if (filterJob !== "all" && c.job_id !== filterJob) return false;
        if (filterRec !== "all" && c.recruiterName !== filterRec) return false;
        if (
          q &&
          !(
            c.name.toLowerCase().includes(q) ||
            c.jobTitle.toLowerCase().includes(q) ||
            c.tags.join(" ").toLowerCase().includes(q)
          )
        )
          return false;
        return true;
      }),
    [items, filterJob, filterRec, q],
  );

  // The stage list that governs the board columns: follows the selected job's
  // client pipeline; the "All roles" view uses the Default.
  const activeStages = useMemo(() => {
    if (filterJob !== "all") {
      const job = jobs.find((j) => j.id === filterJob);
      const cid = job?.clientId ?? null;
      if (cid && clientStages[cid]) return clientStages[cid];
    }
    return defaultStages;
  }, [filterJob, jobs, clientStages, defaultStages]);

  // A candidate's own pipeline (its job's client override, else Default) — used
  // to resolve display name/color and to validate a drag target.
  const stagesForCand = (c: EnrichedCandidate) =>
    (c.clientId && clientStages[c.clientId]) || defaultStages;
  const stageInfoOf = (c: EnrichedCandidate) => {
    const st = stagesForCand(c).find((s) => s.slug === c.stage);
    return { name: st?.name ?? c.stage, color: st?.color ?? "#64748b" };
  };

  const byStage = (slug: string) => filtered.filter((c) => c.stage === slug);
  const active = activeId ? items.find((c) => c.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overStage = e.over?.id ? String(e.over.id) : null;
    if (!overStage) return;
    const cand = items.find((c) => c.id === id);
    if (!cand || cand.stage === overStage) return;
    // Only move into a stage that exists in this candidate's own pipeline.
    const target = stagesForCand(cand).find((s) => s.slug === overStage);
    if (!target) return;
    const prev = items;
    setItems((list) =>
      list.map((c) =>
        c.id === id
          ? { ...c, stage: overStage as EnrichedCandidate["stage"], days: 0 }
          : c,
      ),
    );
    moveCandidateStage(id, overStage).then((res) => {
      if (res.ok) {
        toast.success(`Moved to ${target.name}`);
        router.refresh();
      } else {
        setItems(prev);
        toast.error(res.error ?? "Could not move candidate");
      }
    });
  };

  const dense = layout === "compact";

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-3 p-[16px_26px]">
        <select
          value={filterJob}
          onChange={(e) => setFilterJob(e.target.value)}
          className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#42506b]"
        >
          <option value="all">All Roles</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        {role === "master_admin" && (
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#42506b]"
          >
            <option value="all">All Recruiters</option>
            {recruiters.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <span className="tf-num text-[12.5px] font-semibold text-[#8a94a6]">
          {filtered.length} candidates
        </span>
        {canWrite && (
          <button
            onClick={() => openCandidateForm(null)}
            className="flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-2 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
          >
            <UserPlus size={15} strokeWidth={2.2} /> New Candidate
          </button>
        )}
        <div className="flex-1" />
        <div className="flex gap-0.5 rounded-[10px] bg-[#eef1f6] p-[3px]">
          {(
            [
              ["board", "Board", LayoutGrid],
              ["compact", "Compact", Rows3],
              ["table", "Table", Table2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setLayout(id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition"
              style={
                layout === id
                  ? {
                      background: "#fff",
                      color: "#2a6fdb",
                      boxShadow: "0 1px 3px rgba(20,40,80,.12)",
                    }
                  : { color: "#7a8696" }
              }
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {layout === "table" ? (
        <PipelineTable rows={filtered} stageInfoOf={stageInfoOf} onOpen={openDrawer} />
      ) : (
        <DndContext
          id="pipeline-board"
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-[4px_26px_22px]">
            <div className="flex h-full items-start gap-3.5">
              {activeStages.map((s) => (
                <Column
                  key={s.slug}
                  name={s.name}
                  slug={s.slug}
                  color={s.color}
                  dense={dense}
                  candidates={byStage(s.slug)}
                  stageInfoOf={stageInfoOf}
                  draggable={canWrite}
                  onOpen={openDrawer}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {active && (
              <PipelineCard
                cand={active}
                dense={dense}
                color={stageInfoOf(active).color}
                onOpen={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  name,
  slug,
  color,
  dense,
  candidates,
  stageInfoOf,
  draggable,
  onOpen,
}: {
  name: string;
  slug: string;
  color: string;
  dense: boolean;
  candidates: EnrichedCandidate[];
  stageInfoOf: (c: EnrichedCandidate) => { name: string; color: string };
  draggable: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slug });
  const c = color;
  return (
    <div
      className="flex h-full flex-col"
      style={{ width: dense ? 248 : 284, flexShrink: 0 }}
    >
      <div className="flex items-center gap-2 p-[2px_4px_12px]">
        <span
          className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
          style={{ background: c }}
        />
        <span className="text-[13px] font-extrabold text-[#1c2840]">{name}</span>
        <span
          className="tf-num ml-auto rounded-full px-2.5 py-px text-[11.5px] font-extrabold"
          style={{ color: c, background: hexA(c, 0.12) }}
        >
          {candidates.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl p-1 transition"
        style={{
          background: isOver ? hexA(c, 0.08) : "#f4f6fa",
          border: isOver ? `2px dashed ${c}` : "2px solid transparent",
        }}
      >
        {candidates.map((cand) => (
          <DraggableCard
            key={cand.id}
            cand={cand}
            dense={dense}
            color={stageInfoOf(cand).color}
            draggable={draggable}
            onOpen={onOpen}
          />
        ))}
        {candidates.length === 0 && (
          <div className="rounded-[10px] border-[1.5px] border-dashed border-[#dde3ec] p-[22px_8px] text-center text-[11.5px] font-semibold text-[#b6bfce]">
            Drop candidates here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  cand,
  dense,
  color,
  draggable,
  onOpen,
}: {
  cand: EnrichedCandidate;
  dense: boolean;
  color: string;
  draggable: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cand.id,
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <PipelineCard cand={cand} dense={dense} color={color} onOpen={onOpen} />
    </div>
  );
}

function PipelineCard({
  cand,
  dense,
  color,
  onOpen,
}: {
  cand: EnrichedCandidate;
  dense: boolean;
  color: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(cand.id)}
      className="cursor-pointer rounded-xl border border-[#eaeef4] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,40,80,.04)] transition hover:-translate-y-px hover:border-[#c3d4f0] hover:shadow-[0_6px_18px_rgba(20,40,80,.10)]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={cand.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-[#15213c]">
            {cand.name}
          </div>
          <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">
            {cand.current_designation || "—"}
          </div>
        </div>
        <RatingChip value={cand.rating} />
      </div>
      {/* Which role this candidate is mapped to — so the board tells you who is
          where AND for which position. Skills live in the drawer / Talent view. */}
      <div className="mt-2.5">
        {cand.jobTitle && cand.jobTitle !== "—" ? (
          <div className="flex items-center gap-1.5 rounded-md bg-[#eef4fe] px-2 py-[5px] text-[10.5px] font-bold text-[#2a6fdb]">
            <Briefcase size={12} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate">{cand.jobTitle}</span>
            {cand.jobDept && (
              <span className="shrink-0 font-semibold text-[#7aa0e0]">· {cand.jobDept}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md bg-[#f4f6fa] px-2 py-[5px] text-[10.5px] font-semibold text-[#9aa4b6]">
            <Briefcase size={12} strokeWidth={2.2} className="shrink-0" />
            <span>No role mapped</span>
          </div>
        )}
      </div>
      <div className="mt-[11px] flex items-center justify-between border-t border-[#f0f3f8] pt-2.5">
        <div className="flex items-center gap-1.5">
          <RecBadge name={cand.recruiterName} color={cand.recruiterColor} />
          <span className="text-[11px] font-semibold text-[#8a94a6]">
            {cand.exp_years}y exp
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#a3acbd]">
          <Clock size={11} strokeWidth={2.2} />
          {cand.days}d
        </span>
      </div>
    </div>
  );
}

function PipelineTable({
  rows,
  stageInfoOf,
  onOpen,
}: {
  rows: EnrichedCandidate[];
  stageInfoOf: (c: EnrichedCandidate) => { name: string; color: string };
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-[0_26px_26px]">
      <div className="overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f7f9fc]">
              {["Candidate", "Role", "Stage", "Rating", "Recruiter", "Days", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="p-[12px_18px] text-left text-[11px] font-bold tracking-[.5px] text-[#8a94a6]"
                  >
                    {h.toUpperCase()}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="cursor-pointer border-t border-[#f0f3f8] hover:bg-[#f9fbfe]"
              >
                <td className="p-[12px_18px]">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} size={32} />
                    <div>
                      <div className="text-[13px] font-bold">{r.name}</div>
                      <div className="text-[11px] text-[#9aa4b6]">{r.location}</div>
                    </div>
                  </div>
                </td>
                <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">
                  {r.jobTitle}
                </td>
                <td className="p-[12px_18px]">
                  {(() => {
                    const info = stageInfoOf(r);
                    return (
                      <span
                        className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ color: info.color, background: hexA(info.color, 0.12) }}
                      >
                        {info.name}
                      </span>
                    );
                  })()}
                </td>
                <td className="tf-num p-[12px_18px] text-[13px] font-extrabold text-[#b27400]">
                  ★ {r.rating.toFixed(1)}
                </td>
                <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">
                  {r.recruiterName}
                </td>
                <td className="p-[12px_18px] text-[13px] font-semibold text-[#8a94a6]">
                  {r.days}d
                </td>
                <td className="p-[12px_18px] text-right text-[12px] font-bold text-[#2a6fdb]">
                  View →
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
