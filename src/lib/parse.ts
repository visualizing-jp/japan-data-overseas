/**
 * 海外在留邦人数調査統計 Excel の読み取り。
 *
 * 公表形式は年で4通りある。
 * - 2014・2015・2017: 統計表 4.1（全体・地域別）と 4.2（国別・公館別）。男女・本人/同居家族・職業・年齢つき
 * - 2016: 1枚の横長表。年度ごとの列が並ぶ
 * - 2018・2019・2025: 一覧表（地域は A 列、国は B 列、公館は C 列）
 * - 2020〜2024: 機械判別用の一覧（列見出しが1行）
 * 2018年以降は国別の 総数・長期滞在者・永住者 だけが公表されている。
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import XLSX from "xlsx";
import {
  AGE_BANDS,
  OCCUPATIONS,
  normalizeCountry,
  regionFromLabel,
  type RegionCode,
} from "./labels.ts";

const RAW = resolve(import.meta.dirname, "../../data/raw");

type Cell = string | number | null;

function workbook(year: string): XLSX.WorkBook {
  const path = resolve(RAW, `${year}.xlsx`);
  if (!existsSync(path)) throw new Error(`${path} がない。npm run fetch を先に実行。`);
  return XLSX.read(readFileSync(path));
}

function sheet(wb: XLSX.WorkBook, test: (name: string) => boolean): Cell[][] {
  const name = wb.SheetNames.find(test);
  if (name === undefined) throw new Error(`シートがない: ${wb.SheetNames.join(", ")}`);
  return XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name]!, {
    header: 1,
    raw: true,
    defval: null,
  });
}

function text(v: Cell | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(/\s+/g, "");
}

function num(v: Cell | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(/[,\s]/g, "");
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  }
  return null;
}

function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 「令和７年（２０２５年）」「平成30年(2018年)」から西暦を取る。 */
function westernYear(label: string): string | null {
  const m = toHalfWidth(label).match(/(\d{4})年/);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------- 国別の総数

export interface CountryRow {
  name: string;
  region: RegionCode | null;
  total: number | null;
  long: number | null;
  perm: number | null;
}

export function readCountries(year: string): CountryRow[] {
  const y = Number(year);
  if (y >= 2020 && y <= 2024) return readMachineList(year);
  if (y === 2018 || y === 2019 || y === 2025) return readList(year);
  if (y === 2016) return readWide2016();
  return readTable(year).countries.map((r) => ({
    name: r.name,
    region: r.region,
    total: r.values["total.all.total"] ?? null,
    long: r.values["long.all.total"] ?? null,
    perm: r.values["perm.all.total"] ?? null,
  }));
}

function readMachineList(year: string): CountryRow[] {
  const rows = sheet(workbook(year), () => true);
  const head = rows[0]!.map(text);
  const col = (label: string) => {
    const i = head.findIndex((h) => h.startsWith(label));
    if (i < 0) throw new Error(`${year}: 列 ${label} がない`);
    return i;
  };
  const cRegion = col("地域");
  const cName = col("国（地域）名");
  const cTotal = col("全体集計合計");
  const cLong = col("長期滞在者合計");
  const cPerm = col("永住者合計");
  return rows.slice(1).flatMap((r) => {
    const name = text(r[cName]);
    if (name === "" || name === "合計" || num(r[cTotal]) === null) return [];
    return [
      {
        name: normalizeCountry(name),
        region: regionFromLabel(text(r[cRegion])),
        total: num(r[cTotal]),
        long: num(r[cLong]),
        perm: num(r[cPerm]),
      },
    ];
  });
}

function readList(year: string): CountryRow[] {
  const rows = sheet(workbook(year), (n) => n.trim() === "一覧表");
  const head = rows[0]!.map(text);
  const cTotal = head.indexOf("全体集計");
  const cLong = head.indexOf("長期滞在者");
  const cPerm = head.indexOf("永住者");
  if (cTotal < 0 || cLong < 0 || cPerm < 0) throw new Error(`${year}: 一覧表の見出しが想定と違う`);
  let region: RegionCode | null = null;
  const out: CountryRow[] = [];
  for (const r of rows.slice(2)) {
    const a = text(r[0]);
    if (a === "合計") break;
    if (a !== "") region = regionFromLabel(a);
    const name = text(r[1]);
    if (name === "" || num(r[cTotal]) === null) continue;
    out.push({
      name: normalizeCountry(name),
      region,
      total: num(r[cTotal]),
      long: num(r[cLong]),
      perm: num(r[cPerm]),
    });
  }
  return out;
}

/** 2016年の横長表。列見出しは 区分 / 年度 / 項目 の3段。H28 の列だけ使う。 */
function readWide2016(): CountryRow[] {
  const rows = sheet(workbook("2016"), () => true);
  const width = Math.max(...rows.slice(3, 7).map((r) => r.length));
  const path: { g: string; y: string; k: string }[] = [];
  let g = "";
  let y = "";
  let k = "";
  for (let j = 0; j < width; j++) {
    const g1 = text(rows[3]![j]);
    const y1 = text(rows[4]![j]);
    const k1 = text(rows[5]![j]);
    if (g1 !== "") [g, y, k] = [g1, "", ""];
    if (y1 !== "") [y, k] = [y1, ""];
    if (k1 !== "") k = k1;
    path.push({ g, y, k });
  }
  const find = (group: string, kind: string) => {
    const j = path.findIndex((p) => p.g.startsWith(group) && p.y === "H28" && p.k === kind);
    if (j < 0) throw new Error(`2016: 列 ${group}/${kind} がない`);
    return j;
  };
  const cTotal = find("在留邦人総数", "総数");
  const cPerm = find("（１）永住者", "合計");
  const cLong = find("（２）長期滞在者", "合計");

  const out: CountryRow[] = [];
  for (const r of rows.slice(8)) {
    const name = text(r[1]);
    // 「Ⅰアジア」などの地域小計と「総数」は国ではない
    if (name === "" || name === "総数" || /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/.test(name) || num(r[cTotal]) === null) continue;
    out.push({
      name: normalizeCountry(name),
      region: regionFromLabel(text(r[4])),
      total: num(r[cTotal]),
      long: num(r[cLong]),
      perm: num(r[cPerm]),
    });
  }
  return out;
}

// ---------------------------------------------------------------- 統計表 4.1 / 4.2

export interface DetailRow {
  name: string;
  region: RegionCode | null;
  /**
   * `${区分}.${本人/同居家族}.${性別}` → 人数。区分は total / perm / long / 職業コード。
   * 年齢は `age.${帯}.${性別}`。
   */
  values: Record<string, number | null>;
}

interface Column {
  g: string;
  k: string;
  s: string;
}

/** 4.1 / 4.2 の見出し3段（区分・小区分・男女）を列ごとに引けるようにする。 */
function columns(rows: Cell[][], headerTop: number): Column[] {
  const width = Math.max(...rows.slice(headerTop, headerTop + 3).map((r) => r.length));
  const out: Column[] = [];
  let g = "";
  let k = "";
  for (let j = 0; j < width; j++) {
    const g1 = text(rows[headerTop]![j]);
    const k1 = text(rows[headerTop + 1]![j]);
    if (g1 !== "") [g, k] = [g1, ""];
    if (k1 !== "") k = k1;
    out.push({ g, k, s: text(rows[headerTop + 2]![j]) });
  }
  return out;
}

function groupKey(g: string): string | null {
  if (g.startsWith("在留邦人総数")) return "total";
  if (g.startsWith("（１）永住者")) return "perm";
  if (g.startsWith("（２）長期滞在者")) return "long";
  const occ = OCCUPATIONS.find((o) => g.startsWith("（２）－") && g.includes(o.match));
  return occ?.code ?? null;
}

/** 列番号 → 値のキー。使わない列（前年比・割合など）は入れない。 */
function columnKeys(cols: Column[]): Map<number, string> {
  const keys = new Map<number, string>();
  const seenGroup = new Set<string>();
  cols.forEach((c, j) => {
    if (c.g === "年齢別") {
      if (c.k === "総数") return;
      const band = AGE_BANDS.find((b) => c.k === b.match);
      if (band === undefined) return;
      const sex = c.s === "計" ? "total" : c.s.includes("男性") ? "male" : c.s.includes("女性") ? "female" : null;
      if (sex !== null) keys.set(j, `age.${band.code}.${sex}`);
      return;
    }
    const g = groupKey(c.g);
    if (g === null) return;
    if (!seenGroup.has(g)) {
      seenGroup.add(g);
      keys.set(j, `${g}.all.total`);
      return;
    }
    const person = c.k.startsWith("本人") ? "self" : c.k.startsWith("同居家族") ? "family" : c.k === "性別" ? "all" : null;
    if (person === null) return;
    const sex = c.s === "計" ? "total" : c.s.includes("男性") ? "male" : c.s.includes("女性") ? "female" : null;
    if (sex === null || (person === "all" && sex === "total")) return;
    keys.set(j, `${g}.${person}.${sex}`);
  });
  return keys;
}

function headerRow(rows: Cell[][]): number {
  const i = rows.findIndex((r) => r.some((v) => text(v).startsWith("在留邦人総数")));
  if (i < 0) throw new Error("統計表の見出しが見つからない");
  return i;
}

function readValues(r: Cell[], keys: Map<number, string>): Record<string, number | null> {
  const values: Record<string, number | null> = {};
  for (const [j, key] of keys) values[key] = num(r[j]);
  return values;
}

export function readTable(year: string): { world: DetailRow; regions: DetailRow[]; countries: DetailRow[] } {
  const wb = workbook(year);

  const area = sheet(wb, (n) => /^4[.．]1/.test(n.trim()));
  const aTop = headerRow(area);
  const aKeys = columnKeys(columns(area, aTop));
  let world: DetailRow | null = null;
  const regions: DetailRow[] = [];
  for (const r of area.slice(aTop + 3)) {
    const label = text(r[0]);
    if (label === "") continue;
    const values = readValues(r, aKeys);
    if (values["total.all.total"] == null) continue;
    if (label === "総数") world = { name: "全世界", region: null, values };
    else regions.push({ name: label, region: regionFromLabel(label), values });
  }
  if (world === null) throw new Error(`${year}: 4.1 に総数行がない`);

  const country = sheet(wb, (n) => /^4[.．]2/.test(n.trim()));
  const cTop = headerRow(country);
  const cKeys = columnKeys(columns(country, cTop));
  const countries: DetailRow[] = [];
  let region: RegionCode | null = null;
  for (const r of country.slice(cTop + 3)) {
    const a = text(r[0]);
    const page = toHalfWidth(a).match(/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ](.+?)[－-]\d+$/);
    if (page) {
      region = regionFromLabel(page[1]!);
      continue;
    }
    if (a === "" || /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/.test(a) || a.startsWith("国（地域）名")) continue;
    const values = readValues(r, cKeys);
    if (values["total.all.total"] == null) continue;
    countries.push({ name: normalizeCountry(a), region, values });
  }
  return { world, regions, countries };
}

// ---------------------------------------------------------------- 長期推移・都市

export interface EraRow {
  year: string;
  values: Record<string, number | null>;
}

/** 最新年版の「邦人数推移」。男女の行は年の行の直下にある。 */
export function readEra(year: string): EraRow[] {
  const rows = sheet(workbook(year), (n) => n.trim() === "邦人数推移");
  const h = rows.findIndex(
    (r) => r.some((v) => text(v) === "総数") && r.some((v) => text(v) === "男性"),
  );
  if (h < 0) throw new Error(`${year}: 男女別の推移表がない`);
  const head = rows[h]!.map(text);
  const cYear = head.indexOf("年");
  const groups = [
    { status: "total", col: head.indexOf("総数") },
    { status: "long", col: head.indexOf("長期滞在者") },
    { status: "perm", col: head.indexOf("永住者") },
  ].map((g) => ({ ...g, sexCol: head.findIndex((v, j) => j > g.col && v === "男性") }));
  if (groups.some((g) => g.col < 0 || g.sexCol < 0)) throw new Error(`${year}: 推移表の見出しが想定と違う`);

  const out: EraRow[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const y = westernYear(text(rows[i]![cYear]));
    if (y === null) continue;
    const next = rows[i + 1] ?? [];
    const values: Record<string, number | null> = {};
    for (const g of groups) {
      values[`${g.status}.total`] = num(rows[i]![g.col]);
      values[`${g.status}.male`] = num(rows[i]![g.sexCol]);
      values[`${g.status}.female`] = num(next[g.sexCol]);
    }
    out.push({ year: y, values });
  }
  return out;
}

export interface CityRank {
  year: string;
  rows: { name: string; pop: number }[];
}

/** 最新年版の「都市別邦人数上位50位」。5年分が横に並ぶ。 */
export function readCities(year: string): CityRank[] {
  const rows = sheet(workbook(year), (n) => n.trim().startsWith("都市別邦人数上位"));
  const h = rows.findIndex((r) => r.some((v) => text(v) === "都市名"));
  if (h < 0) throw new Error(`${year}: 都市表の見出しがない`);
  const out: CityRank[] = [];
  rows[h]!.forEach((v, j) => {
    if (text(v) !== "都市名") return;
    const y = westernYear(text(rows[h - 1]![j]));
    if (y === null) return;
    const list: { name: string; pop: number }[] = [];
    for (const r of rows.slice(h + 1)) {
      const name = text(r[j]);
      const pop = num(r[j + 1]);
      if (name === "" || pop === null) continue;
      list.push({ name, pop });
    }
    out.push({ year: y, rows: list });
  });
  return out;
}
