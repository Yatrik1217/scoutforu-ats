"use client";

import { useRef, useState, useTransition } from "react";
import { Search, Check, X } from "lucide-react";
import { searchFunds, type FundHit } from "@/lib/actions/finance";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16a34a]";

// Type-ahead search over AMFI funds. On select, hands back the scheme code (for
// live NAV) and the scheme name. Shows the currently-linked fund as a chip.
export function FundPicker({
  schemeCode,
  schemeLabel,
  onSelect,
  onClear,
}: {
  schemeCode: string | null;
  schemeLabel: string;
  onSelect: (code: string, name: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FundHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounced search, driven by typing (no effect → no cascading renders)
  const onType = (val: string) => {
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 3) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      start(async () => {
        const res = await searchFunds(val);
        setHits(res);
        setOpen(true);
      });
    }, 350);
  };

  if (schemeCode) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[9px] border border-[#16a34a] bg-[#eafaf0] px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-bold text-[#128a3e]">{schemeLabel || `Scheme ${schemeCode}`}</div>
          <div className="text-[10.5px] font-semibold text-[#16a34a]">AMFI code {schemeCode} · live NAV linked</div>
        </div>
        <button type="button" onClick={onClear} className="shrink-0 rounded-[7px] p-1 text-[#128a3e] hover:bg-[#d7f5e3]" title="Unlink fund">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search size={15} className="pointer-events-none absolute left-3 text-[#9aa4b6]" />
        <input
          className={`${field} pl-9`}
          value={q}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search fund by name (e.g. HDFC Mid Cap)…"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[9px] border border-[#e3e8f0] bg-white shadow-lg">
          {pending && <div className="px-3 py-2 text-[12px] text-[#8a94a6]">Searching…</div>}
          {!pending && hits.length === 0 && q.trim().length >= 3 && (
            <div className="px-3 py-2 text-[12px] text-[#8a94a6]">
              No funds found — try the fund house + type (e.g. &ldquo;Kotak Aggressive Hybrid&rdquo;), or paste the AMFI scheme code.
            </div>
          )}
          {hits.map((h) => (
            <button
              key={h.schemeCode}
              type="button"
              onClick={() => {
                onSelect(h.schemeCode, h.schemeName);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-[#f6f8fb]"
            >
              <Check size={13} className="shrink-0 text-[#16a34a] opacity-0" />
              <span className="flex-1">{h.schemeName}</span>
              <span className="shrink-0 text-[10.5px] font-semibold text-[#9aa4b6]">{h.schemeCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
