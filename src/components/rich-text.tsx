"use client";

import { useEffect, useRef } from "react";
import { sanitizeRichText, looksPlainText, plainToHtml } from "@/lib/rich-text";

const btn =
  "rounded-[6px] px-2 py-1 text-[13px] font-bold text-[#42506b] hover:bg-[#eef2f8] active:bg-[#e3ecfb]";

// Lightweight rich-text editor for the Job Description: Bold / Italic /
// Underline / bullet & numbered lists. Emits sanitized HTML. Uses the built-in
// editing commands with CSS styling turned OFF so formatting comes out as clean
// <b>/<i>/<u>/<ul> tags (no style attributes to strip).
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the editor once (re-seeding on every keystroke would jump the caret).
  useEffect(() => {
    if (!ref.current) return;
    const seed = looksPlainText(value) ? plainToHtml(value) : value || "";
    if (ref.current.innerHTML !== seed) ref.current.innerHTML = seed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (ref.current) onChange(sanitizeRichText(ref.current.innerHTML));
  };

  const exec = (cmd: string) => {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* not supported — tags are still produced */
    }
    document.execCommand(cmd);
    emit();
  };

  const tool = (cmd: string, label: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      className={btn}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the text selection when clicking the button
        exec(cmd);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-[10px] border border-[#e3e8f0] focus-within:border-[#2a6fdb]">
      <div className="flex items-center gap-0.5 border-b border-[#eef1f6] px-1.5 py-1">
        {tool("bold", <b>B</b>, "Bold")}
        {tool("italic", <i>I</i>, "Italic")}
        {tool("underline", <u>U</u>, "Underline")}
        <span className="mx-1 h-4 w-px bg-[#e3e8f0]" />
        {tool("insertUnorderedList", <span>• List</span>, "Bulleted list")}
        {tool("insertOrderedList", <span>1. List</span>, "Numbered list")}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-ph={placeholder || ""}
        className="min-h-[150px] max-h-[340px] overflow-y-auto px-3 py-2 text-[13px] leading-relaxed text-[#16203a] outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 empty:before:text-[#9aa4b6] empty:before:content-[attr(data-ph)]"
      />
    </div>
  );
}
