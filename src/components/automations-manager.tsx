"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveStageEmailRule } from "@/lib/actions/automations";

type Stage = { key: string; slug: string; color: string };
type Tmpl = { id: string; name: string };
type Rule = { stage: string; template_id: string | null; enabled: boolean };

export function AutomationsManager({
  stages,
  templates,
  rules,
}: {
  stages: Stage[];
  templates: Tmpl[];
  rules: Rule[];
}) {
  const byStage = new Map(rules.map((r) => [r.stage, r]));
  const [, start] = useTransition();
  const [state, setState] = useState<Record<string, { templateId: string; enabled: boolean }>>(
    () => {
      const s: Record<string, { templateId: string; enabled: boolean }> = {};
      for (const st of stages) {
        const r = byStage.get(st.slug);
        s[st.slug] = { templateId: r?.template_id ?? "", enabled: r?.enabled ?? true };
      }
      return s;
    },
  );

  const update = (slug: string, patch: Partial<{ templateId: string; enabled: boolean }>) => {
    setState((prev) => {
      const next = { ...prev, [slug]: { ...prev[slug], ...patch } };
      const v = next[slug];
      start(async () => {
        const r = await saveStageEmailRule(slug, v.templateId || null, v.enabled);
        if (r.ok) toast.success("Saved");
        else toast.error(r.error ?? "Couldn't save");
      });
      return next;
    });
  };

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <h1 className="mb-1 text-[22px] font-extrabold text-[#16203a]">Action Triggers</h1>
      <p className="mb-5 max-w-2xl text-[13px] text-[#8a94a6]">
        When a candidate moves into a stage, automatically email them a template. Use{" "}
        <code className="rounded bg-[#eef1f6] px-1 font-mono text-[12px]">{"{{name}}"}</code> in the
        template to personalise it. {templates.length === 0 && "Add templates first under Default Emails."}
      </p>

      <div className="overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-3 border-b border-[#eef1f6] bg-[#f7f9fc] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Stage</div>
          <div>Auto-email template</div>
          <div>On</div>
        </div>
        {stages.map((st) => {
          const v = state[st.slug];
          return (
            <div key={st.slug} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 border-b border-[#f4f6fa] px-5 py-3 last:border-0">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#16203a]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />
                {st.key}
              </div>
              <select
                value={v.templateId}
                onChange={(e) => update(st.slug, { templateId: e.target.value })}
                className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2 text-[13px] font-semibold text-[#42506b] outline-none focus:border-[#2a6fdb]"
              >
                <option value="">— No auto-email —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={v.enabled && !!v.templateId}
                  disabled={!v.templateId}
                  onChange={(e) => update(st.slug, { enabled: e.target.checked })}
                  className="h-4.5 w-4.5 cursor-pointer accent-[#16a34a] disabled:opacity-40"
                />
              </label>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[#8a94a6]">
        Emails send from your configured mailbox. A note is logged on the candidate each time one fires.
      </p>
    </div>
  );
}
