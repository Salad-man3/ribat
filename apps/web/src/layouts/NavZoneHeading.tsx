/** Sidebar/drawer section title — not a link (distinct from bottom tabs and nav rows). */
export function NavZoneHeading({ id, label }: { id: string; label: string }) {
  return (
    <div className="pointer-events-none mt-1 flex items-center gap-2 px-1 pt-2 select-none">
      <span className="h-px min-w-2 flex-1 bg-white/25" aria-hidden />
      <h2
        id={id}
        className="text-[11px] font-normal tracking-normal text-chrome-muted/80"
      >
        {label}
      </h2>
      <span className="h-px min-w-2 flex-1 bg-white/25" aria-hidden />
    </div>
  );
}
