/**
 * 2つに割った横バーのランキング（長期／永住、本人／同居家族など）。
 */

const int = new Intl.NumberFormat("ja-JP");

export interface SplitRow {
  code: string;
  label: string;
  /** 濃い側。 */
  a: number | null;
  /** 淡い側。 */
  b: number | null;
}

export function SplitBars({
  rows,
  selected,
  onSelect,
  max = Math.max(...rows.map((r) => (r.a ?? 0) + (r.b ?? 0)), 1),
}: {
  rows: SplitRow[];
  selected?: string;
  onSelect?: (code: string) => void;
  /** 別の一覧と目盛りをそろえるときに渡す。 */
  max?: number;
}) {

  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((r) => {
        const total = r.a === null && r.b === null ? null : (r.a ?? 0) + (r.b ?? 0);
        const isSelected = r.code === selected;
        const body = (
          <>
            <span className="min-w-0">
              <span
                className={`block truncate text-[12px] ${isSelected ? "font-semibold text-ink" : "text-muted"}`}
                title={r.label}
              >
                {r.label}
              </span>
              <span className="mt-0.5 flex h-[6px] overflow-hidden rounded-full bg-ink/[0.06]">
                <span className="block h-full bg-accent/75" style={{ width: `${((r.a ?? 0) / max) * 100}%` }} />
                <span className="block h-full bg-accent/30" style={{ width: `${((r.b ?? 0) / max) * 100}%` }} />
              </span>
            </span>
            <span className="tnum shrink-0 text-[11px] text-ink">{total === null ? "—" : int.format(total)}</span>
          </>
        );
        const cls = "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded px-2 py-1 text-left";
        return (
          <li key={r.code}>
            {onSelect === undefined ? (
              <div className={cls}>{body}</div>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(r.code)}
                aria-pressed={isSelected}
                className={`${cls} cursor-pointer transition-colors duration-150 ${
                  isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
                }`}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SplitLegend({ a, b }: { a: string; b: string }) {
  return (
    <span className="inline-flex items-center gap-3 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-[2px] bg-accent/75" />
        {a}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-[2px] bg-accent/30" />
        {b}
      </span>
    </span>
  );
}
