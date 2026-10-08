/**
 * 時代ビュー。在留邦人数（長期滞在者・永住者）と男女の長期推移。
 */

import { use, useMemo, useState } from "react";
import { loadEra } from "../data/chunks.ts";
import { DEFINITION_CHANGE, NOTES } from "../data/annotations.ts";
import { TrendStack, type Panel, type Point } from "../components/TrendStack.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { useWidth } from "../hooks/useWidth.ts";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const man = (v: number) => (v >= 10_000 ? `${int.format(Math.round(v / 10_000))}万` : int.format(v));

const SHORT: Record<string, string> = { total: "総数", long: "長期", perm: "永住" };

function dense(years: number[], values: (number | null)[]): Point[] {
  return years.map((year, i) => ({ year, value: values[i] ?? null }));
}

function ratio(a: (number | null)[], b: (number | null)[]): (number | null)[] {
  return a.map((v, i) => (v === null || !b[i] ? null : v / b[i]!));
}

function growth(values: (number | null)[]): (number | null)[] {
  return values.map((v, i) => {
    const prev = values[i - 1];
    return v === null || prev == null || prev === 0 ? null : (v / prev - 1) * 100;
  });
}

export function EraView() {
  const { statuses, sexes, years, cube } = use(loadEra());
  const yearNums = useMemo(() => years.map(Number), [years]);
  const [status, setStatus] = useUrlState<string>("status", "total", (v) => statuses.some((s) => s.code === v));
  const [sex, setSex] = useUrlState<string>("sex", "total", (v) => sexes.some((s) => s.code === v));
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const panels = useMemo((): Panel[] => {
    const pop = (status: string, sx = sex) => cube.series("pop", "year", { status, sex: sx });
    const statusSeries = (values: (s: string) => (number | null)[]) =>
      statuses.map((s) => ({
        key: s.code,
        label: SHORT[s.code]!,
        points: dense(yearNums, values(s.code)),
        emphasized: s.code === status,
        projectedFrom: s.code === "total" ? undefined : DEFINITION_CHANGE,
      }));
    return [
      {
        key: "pop",
        title: "在留邦人数",
        unit: "人（10月1日現在）",
        format: (v) => int.format(Math.round(v)),
        formatTick: man,
        series: statusSeries((s) => pop(s)),
      },
      {
        key: "growth",
        title: "増減率",
        unit: "前年比",
        format: (v) => `${pct.format(v)}%`,
        series: statusSeries((s) => growth(pop(s))),
      },
      {
        key: "permShare",
        title: "永住者の割合",
        unit: "在留邦人に占める",
        format: (v) => `${pct.format(v * 100)}%`,
        series: [
          {
            key: "permShare",
            label: "",
            points: dense(yearNums, ratio(pop("perm"), pop("total"))),
            emphasized: true,
            projectedFrom: DEFINITION_CHANGE,
          },
        ],
      },
      {
        key: "female",
        title: "女性の割合",
        unit: "男女計に占める",
        format: (v) => `${pct.format(v * 100)}%`,
        series: statusSeries((s) => ratio(pop(s, "female"), pop(s, "total"))),
      },
    ];
  }, [cube, statuses, status, sex, yearNums]);

  const last = years.at(-1)!;
  const at = (status: string, sx = "total") => cube.at("pop", { status, sex: sx, year: last });
  const total = at("total");
  const figures = [
    { label: "総数", value: total },
    { label: "長期滞在者", value: at("long"), note: "期限を定めて居住" },
    { label: "永住者", value: at("perm"), note: "期限を定めずに居住" },
  ];
  const female = at("total", "female");

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[288px] shrink-0 max-lg:w-full">
        <h2 className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-faint">{last}年</h2>
        <dl className="flex flex-col gap-3 px-2">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] text-muted">
                {f.label}
                {f.note && <span className="ml-1.5 text-faint">{f.note}</span>}
              </dt>
              <dd className="tnum text-[18px] font-semibold tracking-tight">
                {f.value === null ? "—" : int.format(f.value)}
                <span className="ml-0.5 text-[11px] font-normal text-muted">人</span>
              </dd>
            </div>
          ))}
          {female !== null && total !== null && (
            <div>
              <dt className="text-[11px] text-muted">女性</dt>
              <dd className="tnum text-[18px] font-semibold tracking-tight">
                {pct.format((female / total) * 100)}
                <span className="ml-0.5 text-[11px] font-normal text-muted">%</span>
              </dd>
            </div>
          )}
        </dl>
        <p className="px-2 pt-4 text-[10.5px] leading-relaxed text-faint">
          1999年から女性が男性を上回る。長期滞在者は2019年をピークに減り、永住者は2003年から毎年増えている。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">海外に住む日本人</h2>
            <p className="pt-1 text-[12px] text-muted">
              {years[0]}–{last}年。3か月以上の在留者を長期滞在者と永住者に分けて数える。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="在留区分"
              value={status}
              onChange={setStatus}
              options={statuses.map((s) => ({ value: s.code, label: s.label }))}
            />
            <Segmented
              label="性別"
              value={sex}
              onChange={setSex}
              options={sexes.map((s) => ({ value: s.code, label: s.label }))}
            />
          </div>
        </header>

        <div ref={ref}>
          {width > 0 && (
            <TrendStack
              panels={panels}
              width={width}
              domain={[yearNums[0]!, yearNums.at(-1)!]}
              hoverYear={hoverYear}
              onHoverYear={setHoverYear}
            />
          )}
        </div>

        <ul className="mt-4 space-y-1 text-[10.5px] leading-relaxed text-faint">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </main>
    </div>
  );
}
