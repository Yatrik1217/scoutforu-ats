"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// A code/url block with a copy button, used by the Career Page settings.
export function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && (
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9aa4b6]">
          {label}
        </div>
      )}
      <div className="flex items-start gap-2">
        <code className="flex-1 overflow-x-auto whitespace-pre rounded-[9px] border border-[#eef1f6] bg-[#f8fafd] p-[9px_12px] text-[11.5px] leading-[1.6] text-[#42506b]">
          {text}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="flex shrink-0 items-center gap-1 rounded-[8px] border border-[#e6eaf1] bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
        >
          {copied ? <Check size={12} className="text-[#16a34a]" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
