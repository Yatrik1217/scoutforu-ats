"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { previewCas, importCas, type CasHolding } from "@/lib/actions/cas";

const money = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

export function CasImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [holdings, setHoldings] = useState<CasHolding[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const close = () => {
    setOpen(false);
    setHoldings(null);
    setPicked(new Set());
  };

  const read = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    start(async () => {
      const res = await previewCas(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const matched = res.data.filter((h) => h.matchedCode);
      setHoldings(res.data);
      // Pre-select everything we could match to a live fund.
      setPicked(new Set(res.data.map((h, i) => (h.matchedCode ? i : -1)).filter((i) => i >= 0)));
      if (!matched.length) toast.error("No holdings could be matched to a live fund.");
      else toast.success(`Found ${matched.length} holding${matched.length === 1 ? "" : "s"} — review and import.`);
    });
  };

  const doImport = () => {
    if (!holdings) return;
    const chosen = holdings.filter((_, i) => picked.has(i) && holdings[i].matchedCode);
    if (!chosen.length) return toast.error("Nothing selected to import.");
    start(async () => {
      const res = await importCas(chosen);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Imported ${res.data.imported} new · updated ${res.data.updated}.`);
      close();
      router.refresh();
    });
  };

  const totalValue = holdings
    ? holdings.filter((_, i) => picked.has(i)).reduce((s, h) => s + h.liveValue, 0)
    : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a]"
      >
        <FileUp size={14} /> Import from CAS
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4">
          <div className="max-h-[88vh] w-[640px] max-w-full overflow-auto rounded-[16px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)]">
            <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[20px_22px_14px]">
              <div>
                <div className="text-[17px] font-extrabold text-[#16203a]">Import from CAS</div>
                <div className="text-[12px] text-[#8a94a6]">
                  Load all your mutual funds from a Consolidated Account Statement
                </div>
              </div>
              <button
                onClick={close}
                className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"
              >
                <X size={16} />
              </button>
            </div>

            {!holdings ? (
              <form
                className="p-[20px_22px]"
                onSubmit={(e) => {
                  e.preventDefault();
                  read(e.currentTarget);
                }}
              >
                <p className="mb-4 rounded-[10px] bg-[#f6f8fb] p-3 text-[12px] leading-relaxed text-[#5c6880]">
                  Get your <b>CAS</b> free from <b>MFCentral</b> or CAMS/KFintech — it lists every
                  mutual fund you hold across all AMCs in one PDF. It&apos;s password-protected;
                  enter that password below. Units &amp; cost come from the statement, and value then
                  tracks the live NAV daily.
                </p>
                <label className="mb-1 block text-[12px] font-bold text-[#42506b]">CAS PDF</label>
                <input
                  type="file"
                  name="file"
                  accept="application/pdf,.pdf"
                  required
                  className="mb-4 w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px]"
                />
                <label className="mb-1 block text-[12px] font-bold text-[#42506b]">
                  PDF password
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="often your PAN in CAPS"
                  autoComplete="off"
                  className="mb-5 w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-[10px] bg-[#16a34a] py-2.5 text-[13.5px] font-bold text-white hover:bg-[#128a3e] disabled:opacity-50"
                >
                  {pending ? "Reading statement…" : "Read statement"}
                </button>
              </form>
            ) : (
              <div className="p-[16px_22px_20px]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[13px] font-bold text-[#16203a]">
                    {holdings.filter((h) => h.matchedCode).length} matched ·{" "}
                    <span className="text-[#8a94a6]">selected value {money(totalValue)}</span>
                  </div>
                  <button
                    onClick={() => setHoldings(null)}
                    className="text-[12px] font-bold text-[#2a6fdb] hover:underline"
                  >
                    ← Upload another
                  </button>
                </div>
                <div className="overflow-hidden rounded-[11px] border border-[#eef1f6]">
                  {holdings.map((h, i) => {
                    const matched = !!h.matchedCode;
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-3 border-b border-[#f4f6fa] px-3 py-2.5 last:border-0 ${matched ? "cursor-pointer" : "opacity-60"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!matched}
                          checked={picked.has(i)}
                          onChange={(e) => {
                            setPicked((p) => {
                              const n = new Set(p);
                              if (e.target.checked) n.add(i);
                              else n.delete(i);
                              return n;
                            });
                          }}
                          className="h-4 w-4 accent-[#16a34a]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-bold text-[#16203a]">
                            {h.matchedName || h.scheme}
                          </div>
                          <div className="text-[11px] text-[#8a94a6]">
                            {h.units.toLocaleString("en-IN")} units
                            {matched ? (
                              <>
                                {" "}
                                · NAV ₹{h.nav} ·{" "}
                                <CheckCircle2 size={11} className="inline text-[#16a34a]" /> matched
                              </>
                            ) : (
                              <>
                                {" "}
                                · <AlertTriangle size={11} className="inline text-[#e8833a]" /> no
                                live match ({h.isin || "no ISIN"})
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="tf-num text-[12.5px] font-extrabold text-[#16a34a]">
                            {matched ? money(h.liveValue) : "—"}
                          </div>
                          <div className="tf-num text-[10.5px] text-[#8a94a6]">
                            cost {money(h.cost)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={doImport}
                  disabled={pending || picked.size === 0}
                  className="mt-4 w-full rounded-[10px] bg-[#16a34a] py-2.5 text-[13.5px] font-bold text-white hover:bg-[#128a3e] disabled:opacity-50"
                >
                  {pending ? "Importing…" : `Import ${picked.size} holding${picked.size === 1 ? "" : "s"}`}
                </button>
                <p className="mt-2 text-center text-[11px] text-[#8a94a6]">
                  Existing funds are updated (units &amp; cost); new ones are added. Nothing is sent
                  anywhere — this stays in your finance module.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
