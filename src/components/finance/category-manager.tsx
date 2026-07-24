"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveCategory, archiveCategory, type CategoryForm } from "@/lib/actions/finance";
import type {
  FinanceCategoryRow,
  FinanceScope,
  FinanceCategoryKind,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16a34a]";
const label = "block text-[12px] font-bold text-[#42506b] mb-1";

const SWATCHES = [
  "#2a6fdb", "#8b5cf6", "#06b6d4", "#f59e0b", "#16a34a",
  "#ec4899", "#ef4444", "#6366f1", "#e8833a", "#64748b",
];

export function CategoryManager({
  scope,
  categories,
}: {
  scope: FinanceScope;
  categories: FinanceCategoryRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCategoryRow | null>(null);
  const [pending, start] = useTransition();

  const blank: CategoryForm = {
    scope,
    name: "",
    kind: "expense",
    color: SWATCHES[0],
    ebitdaAddback: false,
    sort: (categories.at(-1)?.sort ?? 0) + 10,
  };
  const [f, setF] = useState<CategoryForm>(blank);
  const set = <K extends keyof CategoryForm>(k: K, v: CategoryForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setF(blank);
    setOpen(true);
  };
  const openEdit = (c: FinanceCategoryRow) => {
    setEditing(c);
    setF({
      scope: c.scope,
      name: c.name,
      kind: c.kind,
      color: c.color,
      ebitdaAddback: c.ebitda_addback,
      sort: c.sort,
    });
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      const res = await saveCategory(editing?.id ?? null, f);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });

  const toggleArchive = (c: FinanceCategoryRow) =>
    start(async () => {
      const res = await archiveCategory(c.id, !c.archived);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  return (
    <div className="rounded-[14px] border border-[#e9edf3] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-extrabold capitalize">{scope} categories</div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#16a34a] px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-[#128a3e]"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="flex flex-col divide-y divide-[#f1f4f9]">
        {active.map((c) => (
          <Row key={c.id} c={c} onEdit={() => openEdit(c)} onArchive={() => toggleArchive(c)} />
        ))}
        {active.length === 0 && (
          <div className="py-6 text-center text-[13px] text-[#8a94a6]">No categories yet.</div>
        )}
      </div>

      {archived.length > 0 && (
        <>
          <div className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9aa4b6]">
            Archived
          </div>
          <div className="flex flex-col divide-y divide-[#f1f4f9] opacity-60">
            {archived.map((c) => (
              <Row key={c.id} c={c} onEdit={() => openEdit(c)} onArchive={() => toggleArchive(c)} />
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-extrabold">
              {editing ? "Edit category" : "Add category"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className={label}>Name</label>
              <input className={field} value={f.name} autoFocus onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Type</label>
                <select
                  className={field}
                  value={f.kind}
                  onChange={(e) => set("kind", e.target.value as FinanceCategoryKind)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className={label}>Colour</label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("color", s)}
                      className={`h-6 w-6 rounded-full ${f.color === s ? "ring-2 ring-offset-2 ring-[#0e1320]" : ""}`}
                      style={{ background: s }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {scope === "company" && f.kind === "expense" && (
              <label className="flex items-center gap-2.5 rounded-[9px] bg-[#f6f8fb] p-2.5 text-[12.5px] font-semibold text-[#42506b]">
                <input
                  type="checkbox"
                  checked={f.ebitdaAddback}
                  onChange={(e) => set("ebitdaAddback", e.target.checked)}
                />
                Below the EBITDA line (Interest / Tax / Depreciation) — excluded from operating expenses
              </label>
            )}
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-[9px] px-3.5 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f1f4f9]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-[9px] bg-[#16a34a] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#128a3e] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  c,
  onEdit,
  onArchive,
}: {
  c: FinanceCategoryRow;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
      <span className="flex-1 text-[13px] font-semibold">{c.name}</span>
      {c.kind === "income" && (
        <span className="rounded-full bg-[#eafaf0] px-2 py-0.5 text-[10.5px] font-bold text-[#128a3e]">
          Income
        </span>
      )}
      {c.ebitda_addback && (
        <span className="rounded-full bg-[#fef3e2] px-2 py-0.5 text-[10.5px] font-bold text-[#b45309]">
          Below EBITDA
        </span>
      )}
      <button onClick={onEdit} className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#f1f4f9] hover:text-[#2a6fdb]" title="Edit">
        <Pencil size={14} />
      </button>
      <button
        onClick={onArchive}
        className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#f1f4f9]"
        title={c.archived ? "Restore" : "Archive"}
      >
        {c.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
      </button>
    </div>
  );
}
