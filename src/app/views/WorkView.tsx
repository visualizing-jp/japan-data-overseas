/**
 * 仕事ビュー。2017年の長期滞在者の職業（本人／同居家族）と年齢。
 * 職業・男女・年齢の内訳が国別に公表された最後の年。
 */

import { use } from "react";
import { loadDetail } from "../data/chunks.ts";
import { NOTES } from "../data/annotations.ts";
import { Segmented } from "../components/Segmented.tsx";
import { SplitBars, SplitLegend } from "../components/SplitBars.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

/** 一覧に出す国の数（2017年の在留邦人数順）。 */
const COUNTRY_TOP = 30;

export function WorkView() {
  const { year, areas, occupations, sexes, ages, detail, age } = use(loadDetail());
  const [area, setArea] = useUrlState<string>("area", "world", (v) => areas.some((a) => a.code === v));
  const [sex, setSex] = useUrlState<string>("sex", "total", (v) => sexes.some((s) => s.code === v));

  const current = areas.find((a) => a.code === area)!;
  const v = (group: string, person: string, sx = sex) => detail.at("pop", { area, group, person, sex: sx });
  const total = v("total", "all");

  const occRows = occupations.map((o) => ({ code: o.code, label: o.label, a: v(o.code, "self"), b: v(o.code, "family") }));
  const permRows = [{ code: "perm", label: "永住者", a: v("perm", "self"), b: v("perm", "family") }];
  const barMax = Math.max(...[...occRows, ...permRows].map((r) => (r.a ?? 0) + (r.b ?? 0)), 1);

  const pyramid = ages.map((b) => ({
    ...b,
    male: age.at("pop", { area, age: b.code, sex: "male" }),
    female: age.at("pop", { area, age: b.code, sex: "female" }),
  }));
  const pyramidMax = Math.max(...pyramid.flatMap((r) => [r.male ?? 0, r.female ?? 0]), 1);

  const list = [
    ...areas.filter((a) => a.level < 2),
    ...areas.filter((a) => a.level === 2).slice(0, COUNTRY_TOP),
  ];
  if (!list.some((a) => a.code === area)) list.push(current);

  const privateSelf = v("private", "self", "male");
  const privateSelfAll = v("private", "self", "total");
  const privateFamily = v("private", "family", "female");
  const privateFamilyAll = v("private", "family", "total");

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[288px] shrink-0 max-lg:w-full">
        <h2 className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">地域・国（{year}年の人数順）</h2>
        <ul className="flex max-h-[70vh] flex-col overflow-y-auto lg:max-h-[calc(100dvh-8rem)]">
          {list.map((a, i) => {
            const isSelected = a.code === area;
            const pop = detail.at("pop", { area: a.code, group: "total", person: "all", sex: "total" });
            return (
              <li key={a.code} className={a.level === 2 && list[i - 1]?.level !== 2 ? "mt-2 border-t border-rule pt-2" : ""}>
                <button
                  type="button"
                  onClick={() => setArea(a.code)}
                  aria-pressed={isSelected}
                  className={`flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-left transition-colors duration-150 ${
                    isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
                  }`}
                >
                  <span
                    className={`flex-1 truncate text-[12px] ${isSelected ? "font-semibold text-ink" : "text-muted"} ${
                      a.level === 1 ? "pl-2" : ""
                    }`}
                  >
                    {a.label}
                  </span>
                  <span className="tnum text-[11px] text-faint">{pop === null ? "—" : int.format(pop)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{current.label}</h2>
            <p className="pt-1 text-[12px] text-muted">
              {year}年{" "}
              <span className="tnum font-medium text-ink">{total === null ? "—" : `${int.format(total)}人`}</span>
              {sex !== "total" && `（${sexes.find((s) => s.code === sex)!.label}）`}
            </p>
          </div>
          <Segmented
            label="性別"
            value={sex}
            onChange={setSex}
            options={sexes.map((s) => ({ value: s.code, label: s.label }))}
          />
        </header>

        <p className="max-w-[62ch] pb-6 text-[12px] leading-relaxed text-muted">
          職業・男女・年齢の内訳が国別に公表された最後の年が{year}年。2018年以降は国ごとの総数・長期滞在者・永住者だけになった。
          {sex === "total" && privateSelf !== null && privateSelfAll && privateFamily !== null && privateFamilyAll && (
            <>
              {" "}
              民間企業の本人の{pct.format((privateSelf / privateSelfAll) * 100)}%は男性で、その同居家族の
              {pct.format((privateFamily / privateFamilyAll) * 100)}%は女性。
            </>
          )}
        </p>

        <section className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pb-2">
              <h3 className="text-[13px] font-semibold">
                長期滞在者の職業
                <span className="ml-1.5 text-[11px] font-normal text-faint">家族は本人の職業に数える</span>
              </h3>
              <SplitLegend a="本人" b="同居家族" />
            </div>
            <SplitBars rows={occRows} max={barMax} />
            <h3 className="mt-4 border-t border-rule px-2 pt-3 pb-1 text-[11px] font-semibold text-faint">
              参考: 永住者（職業の内訳は公表されていない）
            </h3>
            <SplitBars rows={permRows} max={barMax} />
          </div>

          <div>
            <div className="flex items-baseline justify-between px-2 pb-2">
              <h3 className="text-[13px] font-semibold">年齢</h3>
              <span className="text-[11px] text-muted">男 ← → 女</span>
            </div>
            <ul className="flex flex-col gap-1 px-2">
              {pyramid.map((r) => (
                <li key={r.code} className="grid grid-cols-[1fr_4.5rem_1fr] items-center gap-2 text-[11px]">
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="tnum text-faint">{r.male === null ? "—" : int.format(r.male)}</span>
                    <span
                      className={`block h-[10px] rounded-l-[2px] ${sex === "female" ? "bg-ink/15" : "bg-accent/75"}`}
                      style={{ width: `${((r.male ?? 0) / pyramidMax) * 60}%` }}
                    />
                  </span>
                  <span className="text-center text-muted">{r.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`block h-[10px] rounded-r-[2px] ${sex === "male" ? "bg-ink/15" : "bg-accent/75"}`}
                      style={{ width: `${((r.female ?? 0) / pyramidMax) * 60}%` }}
                    />
                    <span className="tnum text-faint">{r.female === null ? "—" : int.format(r.female)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-2 pt-2 text-[10.5px] leading-relaxed text-faint">長期滞在者と永住者の合計。</p>
          </div>
        </section>

        <ul className="mt-8 space-y-1 text-[10.5px] leading-relaxed text-faint">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>
            「留学生・研究者・教師」の留学生は、日本学生支援機構「日本人学生留学状況調査」とは集め方も定義も違う。
          </li>
        </ul>
      </main>
    </div>
  );
}
