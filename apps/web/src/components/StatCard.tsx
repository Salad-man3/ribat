export function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string | undefined | null;
  suffix?: string;
}) {
  const display =
    value === undefined || value === null
      ? '…'
      : typeof value === 'number' && value >= 200
        ? '200+'
        : value;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {display}
        {suffix && value !== undefined && value !== null ? (
          <span className="ms-1 text-base font-normal text-muted">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}
