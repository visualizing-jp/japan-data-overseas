/**
 * 地域ビュー。地域・国の在留邦人数（2014年以降）と上位都市。
 */

import { use, useMemo, useState } from "react";
import { loadGeo } from "../data/chunks.ts";
import { DEFINITION_CHANGE, NOTES } from "../data/annotations.ts";
import { AreaList } from "../components/AreaList.tsx";
import { SplitBars, SplitLegend } from "../components/SplitBars.tsx";
import { TrendStack, type Panel } from "../components/TrendStack.tsx";
import { YearSelect } from "../components/YearSelect.tsx";
import { useWidth } from "../hooks/useWidth.ts";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const man = (v: number) => (v >= 10_000 ? `${int.format(Math.round(v / 10_000))}万` : int.format(v));

/** 全世界を選んでいるときの国ランキングの件数。 */
const WORLD_TOP = 30;

export function GeoView() {
  const { years, areas, cities, cube } = use(loadGeo());
  const yearNums = useMemo(() => years.map(Number), [years]);
  const [area, setArea] = useUrlState<string>("area", "world", (v) => areas.some((a) => a.code === v));
  const [year, setYear] = useUrlState<string>("year", years.at(-1)!, (v) => years.includes(v));
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const current = areas.find((a) => a.code === area)!;
  /** 国を選んでいるときは、その国の地域でランキングを出す。 */
  const scope = current.level === 2 ? current.region! : current.code;
  const scopeLabel = areas.find((a) => a.code === scope)!.label;
  const pop = (code: string, status: string, y = year) => cube.at("pop", { area: code, status, year: y });

  const regionRows = useMemo(
    () =>
      areas
        .filter((a) => a.level < 2)
        .map((a) => ({ area: a, values: cube.series("pop", "year", { area: a.code, status: "total" }) })),
    [areas, cube],
  );

  const ranking = areas
    .filter((a) => a.level === 2 && (scope === "world" || a.region === scope))
    .map((a) => ({ code: a.code, label: a.label, a: pop(a.code, "long"), b: pop(a.code, "perm") }))
    .filter((r) => r.a !== null || r.b !== null)
    .sort((x, y) => (y.a ?? 0) + (y.b ?? 0) - ((x.a ?? 0) + (x.b ?? 0)))
    .slice(0, scope === "world" ? WORLD_TOP : undefined);

  const panels = useMemo((): Panel[] => {
    const series = (status: string) => cube.series("pop", "year", { area, status });
    const points = (values: (number | null)[]) => yearNums.map((y, i) => ({ year: y, value: values[i] ?? null }));
    const total = series("total");
    const perm = series("perm");
    return [
      {
        key: "pop",
        title: "在留邦人数",
        unit: "人",
        format: (v) => int.format(Math.round(v)),
        formatTick: man,
        series: [
          { key: "total", label: "総数", points: points(total), emphasized: true },
          {
            key: "long",
            label: "長期",
            points: points(series("long")),
            emphasized: false,
            projectedFrom: DEFINITION_CHANGE,
          },
          { key: "perm", label: "永住", points: points(perm), emphasized: false, projectedFrom: DEFINITION_CHANGE },
        ],
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
            points: points(perm.map((v, i) => (v === null || !total[i] ? null : v / total[i]!))),
            emphasized: true,
            projectedFrom: DEFINITION_CHANGE,
          },
        ],
      },
    ];
  }, [cube, area, yearNums]);

  const total = pop(area, "total");
  const cityRank = cities.find((c) => c.year === year) ?? cities[0]!;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[288px] shrink-0 max-lg:w-full">
        <h2 className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">地域</h2>
        <AreaList rows={regionRows} years={yearNums} selected={scope} onSelect={setArea} />
        <p className="px-2 pt-3 text-[10.5px] leading-relaxed text-faint">
          地域は外務省の区分。メキシコとカリブ海の国は中米、ロシアと中央アジアは東欧・旧ソ連、トルコとイランは中東、グアムとサイパンは大洋州に入る。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              {current.level === 2 && <span className="mr-2 text-[13px] font-normal text-muted">{scopeLabel}</span>}
              {current.label}
            </h2>
            <p className="pt-1 text-[12px] text-muted">
              {year}年{" "}
              <span className="tnum font-medium text-ink">{total === null ? "非公表" : `${int.format(total)}人`}</span>
            </p>
          </div>
          <YearSelect years={years} value={year} onChange={setYear} />
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

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pb-2">
              <h3 className="text-[13px] font-semibold">
                {scope === "world" ? `国・地域 上位${WORLD_TOP}` : `${scopeLabel}の国・地域`}
                <span className="ml-1.5 text-[11px] font-normal text-faint">{year}年</span>
              </h3>
              <SplitLegend a="長期滞在者" b="永住者" />
            </div>
            <SplitBars rows={ranking} selected={area} onSelect={setArea} />
          </div>
          <div>
            <div className="px-2 pb-2">
              <h3 className="text-[13px] font-semibold">
                都市 上位{cityRank.rows.length}
                <span className="ml-1.5 text-[11px] font-normal text-faint">{cityRank.year}年・全世界</span>
              </h3>
            </div>
            <SplitBars rows={cityRank.rows.map((r) => ({ code: r.name, label: r.name, a: r.pop, b: null }))} />
            <p className="px-2 pt-2 text-[10.5px] leading-relaxed text-faint">
              都市の順位は最新版に載る {cities.at(-1)!.year}–{cities[0]!.year}年だけ。それより前の年を選ぶと {cities[0]!.year}年を出す。
            </p>
          </div>
        </section>

        <ul className="mt-6 space-y-1 text-[10.5px] leading-relaxed text-faint">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </main>
    </div>
  );
}
