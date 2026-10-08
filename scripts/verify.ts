/**
 * 配信 JSON の健全性チェック。公表値（2025年版の地域別合計）と突き合わせる。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA = resolve(import.meta.dirname, "../public/data");

interface Dim {
  name: string;
  codes: string[];
}
interface CubeFile {
  dims: Dim[];
  measures: Record<string, (number | null)[]>;
}

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(DATA, name), "utf8")) as T;
}

function at(cube: CubeFile, coords: Record<string, string>): number | null {
  let off = 0;
  let stride = 1;
  for (let i = cube.dims.length - 1; i >= 0; i--) {
    const d = cube.dims[i]!;
    const idx = d.codes.indexOf(coords[d.name]!);
    if (idx < 0) throw new Error(`bad ${d.name}=${coords[d.name]}`);
    off += idx * stride;
    stride *= d.codes.length;
  }
  return cube.measures.pop![off] ?? null;
}

let failed = 0;
function check(cond: boolean, msg: string): void {
  console.log(cond ? "ok  " : "FAIL", msg);
  if (!cond) failed++;
}

const meta = load<{ latestYear: string; eraYears: string[]; geoYears: string[]; detailYear: string }>("meta.json");
const era = load<CubeFile>("era.json");
const geo = load<CubeFile & { areas: { code: string; level: number; region: string | null }[] }>("geo.json");
const detail = load<{ areas: { code: string; level: number }[]; detail: CubeFile; age: CubeFile }>("detail.json");
const y = meta.latestYear;

// 長期推移: 総数 = 長期 + 永住、計 = 男 + 女
let eraOk = true;
for (const year of meta.eraYears) {
  const t = at(era, { status: "total", sex: "total", year });
  const l = at(era, { status: "long", sex: "total", year });
  const p = at(era, { status: "perm", sex: "total", year });
  const m = at(era, { status: "total", sex: "male", year });
  const f = at(era, { status: "total", sex: "female", year });
  if (t === null || l === null || p === null || m === null || f === null || t !== l + p || t !== m + f) {
    console.log("  era mismatch", year, { t, l, p, m, f });
    eraOk = false;
  }
}
check(eraOk, `era ${meta.eraYears[0]}–${meta.eraYears.at(-1)}: 総数 = 長期 + 永住 = 男 + 女`);
check(at(era, { status: "total", sex: "total", year: y }) === 1_298_170, `${y} 総数 1,298,170`);

// 地域別: 国の合計が公表値と一致（2025年版 一覧表の地域行）
const PUBLISHED_2025: Record<string, number> = {
  asia: 347_333,
  oceania: 131_707,
  namerica: 491_701,
  camerica: 11_920,
  samerica: 72_264,
  weurope: 215_695,
  eeurope: 10_281,
  mideast: 10_646,
  africa: 6_592,
  antarctica: 31,
};
for (const [code, v] of Object.entries(PUBLISHED_2025)) {
  const got = at(geo, { area: code, status: "total", year: "2025" });
  check(got === v, `2025 ${code} ${got} == ${v}`);
}

// 各年: 国の合計 ≈ 全世界（非公表国の分だけ国の合計が小さくなりうる）
for (const year of meta.geoYears) {
  let sum = 0;
  for (const a of geo.areas) {
    if (a.level !== 2) continue;
    sum += at(geo, { area: a.code, status: "total", year }) ?? 0;
  }
  const world = at(geo, { area: "world", status: "total", year })!;
  check(sum <= world && world - sum < world * 0.01, `${year} 国の合計 ${sum} ≈ 全世界 ${world}`);
}

// 国: 総数 = 長期 + 永住
let geoOk = true;
for (const a of geo.areas) {
  for (const year of meta.geoYears) {
    const t = at(geo, { area: a.code, status: "total", year });
    if (t === null) continue;
    const l = at(geo, { area: a.code, status: "long", year }) ?? 0;
    const p = at(geo, { area: a.code, status: "perm", year }) ?? 0;
    if (t !== l + p) {
      console.log("  geo mismatch", a.code, year, { t, l, p });
      geoOk = false;
    }
  }
}
check(geoOk, "国・地域: 総数 = 長期 + 永住");

// 詳細（2017）: 長期滞在者 = 職業の合計、本人 + 家族 = 計、地域の合計 = 全世界
const OCC = ["private", "academic", "freelance", "government", "press", "other"];
const d = detail.detail;
const val = (area: string, group: string, person: string, sex: string) => at(d, { area, group, person, sex }) ?? 0;
let detailOk = true;
for (const a of detail.areas) {
  const long = val(a.code, "long", "all", "total");
  const occ = OCC.reduce((n, g) => n + val(a.code, g, "all", "total"), 0);
  const total = val(a.code, "total", "all", "total");
  const lp = long + val(a.code, "perm", "all", "total");
  const mf = val(a.code, "total", "all", "male") + val(a.code, "total", "all", "female");
  if (long !== occ || total !== lp || total !== mf) {
    console.log("  detail mismatch", a.code, { total, long, occ, lp, mf });
    detailOk = false;
  }
}
check(detailOk, `${meta.detailYear} 総数 = 長期 + 永住 = 男 + 女、長期 = 職業の合計`);
const selfFamily = OCC.every(
  (g) => val("world", g, "all", "total") === val("world", g, "self", "total") + val("world", g, "family", "total"),
);
check(selfFamily, `${meta.detailYear} 全世界: 職業ごとに 本人 + 家族 = 計`);
const regionSum = detail.areas.filter((a) => a.level === 1).reduce((n, a) => n + val(a.code, "total", "all", "total"), 0);
check(regionSum === val("world", "total", "all", "total"), `${meta.detailYear} 地域の合計 ${regionSum} = 全世界`);
const ageSum = ["u20", "20s", "30s", "40s", "50s", "60plus"].reduce(
  (n, b) => n + (at(detail.age, { area: "world", age: b, sex: "total" }) ?? 0),
  0,
);
check(ageSum === val("world", "total", "all", "total"), `${meta.detailYear} 年齢の合計 ${ageSum} = 全世界`);

if (failed > 0) {
  console.error(`${failed} checks failed`);
  process.exit(1);
}
console.log("all checks passed");
