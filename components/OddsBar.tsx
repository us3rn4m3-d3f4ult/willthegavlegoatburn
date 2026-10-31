import { fmtPct } from "@/lib/format";

export function OddsBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className="num text-[64px] font-bold leading-none tracking-[-0.03em] text-fg">
          {fmtPct(pct)}
        </span>
        <span className="mb-2 text-[13px] font-medium text-muted">chance it burns</span>
      </div>

      <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-l-full bg-gradient-to-r from-yes to-ember transition-[width] duration-300"
          style={{ width: `${pct * 100}%` }}
        />
        <div className="h-full flex-1 bg-no/70" />
      </div>

      <div className="mt-2.5 flex justify-between text-[12px]">
        <span className="font-medium text-yes">Yes {fmtPct(pct)}</span>
        <span className="font-medium text-no">No {fmtPct(1 - pct)}</span>
      </div>
    </div>
  );
}
