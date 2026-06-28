import {
  initials,
  avatarColor,
  stageColor,
  hexA,
  TYPE_COLOR,
  type StageKey,
  type InterviewType,
} from "@/lib/domain";

export function Avatar({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size > 36 ? 11 : 9,
        background: avatarColor(name),
        fontSize: size <= 20 ? 9 : size <= 32 ? 12 : size <= 42 ? 15 : 16,
      }}
    >
      {initials(name)}
    </div>
  );
}

export function RecBadge({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
      style={{ background: color }}
    >
      {initials(name)}
    </div>
  );
}

export function StageBadge({ stage }: { stage: StageKey }) {
  const c = stageColor(stage);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: c, background: hexA(c, 0.12) }}
    >
      {stage}
    </span>
  );
}

export function TypePill({ type }: { type: InterviewType }) {
  const c = TYPE_COLOR[type] ?? "#64748b";
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: c, background: hexA(c, 0.12) }}
    >
      {type}
    </span>
  );
}

export function RatingChip({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-[3px] rounded-md bg-[#fff7e6] px-1.5 py-0.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
      <span className="tf-num text-[11px] font-extrabold text-[#b27400]">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#e9edf3] bg-white ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function typeLabelFromEnum(t: string): InterviewType {
  return ((t[0]?.toUpperCase() ?? "") + t.slice(1)) as InterviewType;
}
