"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  addPipelineStage,
  renamePipelineStage,
  setPipelineStageColor,
  setPipelineStageOutcome,
  movePipelineStage,
  deletePipelineStage,
  customizeClientPipeline,
  resetClientPipeline,
} from "@/lib/actions/pipeline";
import type { PipelineStageRow, StageOutcome } from "@/lib/pipeline";

const OUTCOME_LABEL: Record<StageOutcome, string> = {
  in_progress: "In progress",
  won: "Won · Hired",
  lost: "Lost · Rejected",
};
const OUTCOME_COLOR: Record<StageOutcome, string> = {
  in_progress: "#64748b",
  won: "#16a34a",
  lost: "#ef4444",
};

export function PipelineManager({
  stages,
  clients,
}: {
  stages: PipelineStageRow[];
  clients: { id: string; name: string }[];
}) {
  // scope: "default" or a client id
  const [scope, setScope] = useState<string>("default");
  const [pending, start] = useTransition();

  const defaultStages = useMemo(
    () => stages.filter((s) => s.client_id === null).sort((a, b) => a.position - b.position),
    [stages],
  );
  const overrideByClient = useMemo(() => {
    const m = new Map<string, PipelineStageRow[]>();
    for (const s of stages) {
      if (s.client_id === null) continue;
      const arr = m.get(s.client_id) ?? [];
      arr.push(s);
      m.set(s.client_id, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.position - b.position);
    return m;
  }, [stages]);

  const isClient = scope !== "default";
  const clientId = isClient ? scope : null;
  const override = clientId ? overrideByClient.get(clientId) ?? [] : [];
  const hasOverride = override.length > 0;
  const editable = isClient ? hasOverride : true;
  const rows = isClient ? override : defaultStages;
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
      } else toast.error(res.error || "Failed");
    });

  return (
    <div>
      {/* scope picker */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <label className="text-[12.5px] font-bold text-[#42506b]">Editing pipeline for</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]"
        >
          <option value="default">Default (all clients)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {overrideByClient.has(c.id) ? " · custom" : ""}
            </option>
          ))}
        </select>
        {isClient && hasOverride && (
          <button
            onClick={() =>
              run(() => resetClientPipeline(clientId!))
            }
            disabled={pending}
            className="ml-auto flex items-center gap-1.5 rounded-[9px] border border-[#e6eaf1] bg-white px-3 py-2 text-[12px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-50"
          >
            <RotateCcw size={13} /> Reset to Default
          </button>
        )}
      </div>

      {/* client with no override yet → inherit + customize */}
      {isClient && !hasOverride && (
        <div className="mb-4 rounded-[12px] border border-[#e9edf3] bg-[#f8fafc] p-4">
          <div className="text-[13px] font-bold text-[#16203a]">
            {clientName} uses the <span className="text-[#2a6fdb]">Default</span> pipeline
          </div>
          <p className="mt-1 text-[12.5px] text-[#8a94a6]">
            Create a custom pipeline for this client to change its stages independently. It starts as
            a copy of the Default, then you can edit it freely.
          </p>
          <button
            onClick={() => run(() => customizeClientPipeline(clientId!))}
            disabled={pending}
            className="mt-3 flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
          >
            <Plus size={15} /> Customize for {clientName}
          </button>
        </div>
      )}

      {/* stage editor */}
      {editable && (
        <>
          <div className="overflow-hidden rounded-[12px] border border-[#eef1f6]">
            {rows.map((s, i) => (
              <StageRow
                key={s.id}
                row={s}
                first={i === 0}
                last={i === rows.length - 1}
                pending={pending}
                run={run}
              />
            ))}
          </div>
          <AddStage clientId={clientId} pending={pending} run={run} />
          <p className="mt-3 text-[12px] text-[#8a94a6]">
            Renaming a stage keeps candidates already in it. You can&apos;t delete a stage that still
            has candidates — move them first. On the board, columns follow the job&apos;s client
            pipeline (the <b>All jobs</b> view shows the Default).
          </p>
        </>
      )}

      {/* read-only preview of the Default for an inheriting client */}
      {isClient && !hasOverride && (
        <div className="mt-2 overflow-hidden rounded-[12px] border border-[#eef1f6] opacity-70">
          {defaultStages.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0"
            >
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-[13px] font-semibold text-[#16203a]">{s.name}</span>
              <span className="text-[11px] font-bold" style={{ color: OUTCOME_COLOR[s.outcome] }}>
                {OUTCOME_LABEL[s.outcome]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StageRow({
  row,
  first,
  last,
  pending,
  run,
}: {
  row: PipelineStageRow;
  first: boolean;
  last: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void;
}) {
  const [name, setName] = useState(row.name);

  return (
    <div className="flex items-center gap-2.5 border-b border-[#f4f6fa] px-3 py-2.5 last:border-0">
      <div className="flex flex-col">
        <button
          onClick={() => run(() => movePipelineStage(row.id, "up"))}
          disabled={pending || first}
          className="text-[#c2cad6] hover:text-[#2a6fdb] disabled:opacity-30"
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={() => run(() => movePipelineStage(row.id, "down"))}
          disabled={pending || last}
          className="text-[#c2cad6] hover:text-[#2a6fdb] disabled:opacity-30"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      <input
        type="color"
        value={row.color}
        onChange={(e) => run(() => setPipelineStageColor(row.id, e.target.value))}
        disabled={pending}
        className="h-7 w-7 cursor-pointer rounded-[6px] border border-[#e3e8f0] bg-white p-0.5"
        title="Stage color"
      />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== row.name && run(() => renamePipelineStage(row.id, name))}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={pending}
        className="flex-1 rounded-[8px] border border-transparent px-2 py-1.5 text-[13px] font-semibold text-[#16203a] outline-none hover:border-[#e3e8f0] focus:border-[#2a6fdb]"
      />

      <select
        value={row.outcome}
        onChange={(e) => run(() => setPipelineStageOutcome(row.id, e.target.value as StageOutcome))}
        disabled={pending}
        className="cursor-pointer rounded-[8px] border border-[#e3e8f0] bg-white px-2 py-1.5 text-[11.5px] font-bold outline-none focus:border-[#2a6fdb]"
        style={{ color: OUTCOME_COLOR[row.outcome] }}
      >
        <option value="in_progress">In progress</option>
        <option value="won">Won · Hired</option>
        <option value="lost">Lost · Rejected</option>
      </select>

      <button
        onClick={() => run(() => deletePipelineStage(row.id))}
        disabled={pending}
        className="text-[#c2cad6] hover:text-[#dc2626] disabled:opacity-40"
        title="Delete stage"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function AddStage({
  clientId,
  pending,
  run,
}: {
  clientId: string | null;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void;
}) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    run(() => addPipelineStage(clientId, name));
    setName("");
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Add a stage… (e.g. CEO Round)"
        className="flex-1 rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
      />
      <button
        onClick={add}
        disabled={pending || !name.trim()}
        className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
      >
        <Plus size={15} /> Add
      </button>
    </div>
  );
}
