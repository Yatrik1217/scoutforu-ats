"use client";

import { useEffect, useRef, useState } from "react";

// Numeric text input that keeps exactly what you type.
//
// A plain controlled input bound to `String(value)` swallows decimals: typing
// "7." parses to 7, re-renders as "7", and the point is gone before you can
// type "5". This keeps the raw text locally and only reports the parsed number
// upward, so "7.5", "0.5" and a cleared field all behave.
export function NumberInput({
  value,
  onChange,
  decimals = true,
  className,
  placeholder,
  disabled,
  title,
}: {
  value: number;
  onChange: (n: number) => void;
  decimals?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [text, setText] = useState<string>(() => (value ? String(value) : ""));
  const lastReported = useRef<number>(value);

  // Adopt values changed from outside (e.g. candidate autofill), but never
  // clobber what's mid-typing — "7." reports 7, which is already `value`.
  useEffect(() => {
    if (value !== lastReported.current) {
      setText(value ? String(value) : "");
      lastReported.current = value;
    }
  }, [value]);

  return (
    <input
      inputMode={decimals ? "decimal" : "numeric"}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      className={className}
      onChange={(e) => {
        const clean = decimals
          ? e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
          : e.target.value.replace(/\D/g, "");
        setText(clean);
        const n = parseFloat(clean);
        const next = Number.isNaN(n) ? 0 : n;
        lastReported.current = next;
        onChange(next);
      }}
      onBlur={() => {
        // Tidy a trailing "." or a lone "." when leaving the field.
        if (text.endsWith(".") || text === ".") setText(value ? String(value) : "");
      }}
    />
  );
}
