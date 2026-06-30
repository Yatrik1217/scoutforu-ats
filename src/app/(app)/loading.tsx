// Shown instantly during navigation while the page's server data loads, so the
// content area never appears frozen. The sidebar/topbar (layout) stay in place.
export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#dbe3f0] border-t-[#2a6fdb]" />
        <div className="text-[12.5px] font-semibold text-[#9aa4b6]">Loading…</div>
      </div>
    </div>
  );
}
