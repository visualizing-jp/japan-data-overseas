/**
 * Excel → public/data/*.json（Cube）。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Cube } from "../src/lib/cube.ts";
import {
  AGE_BANDS,
  OCCUPATIONS,
  PERSONS,
  REGIONS,
  SEXES,
  STATUSES,
  WORLD,
  type RegionCode,
} from "../src/lib/labels.ts";
import { readCities, readCountries, readEra, readTable, type CountryRow } from "../src/lib/parse.ts";

const OUT = resolve(import.meta.dirname, "../public/data");
const CATALOG = resolve(import.meta.dirname, "catalog.json");
/** 職業・男女・年齢の内訳が国別に公表された最後の年。 */
const DETAIL_YEAR = "2017";

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const years = Object.keys(JSON.parse(readFileSync(CATALOG, "utf8")) as Record<string, string>).sort();
  const latest = years.at(-1)!;

  // --- era: status × sex × year（最新年版の長期推移）
  const eraRows = readEra(latest);
  const eraYears = eraRows.map((r) => r.year);
  const era = new Cube(
    [
      { name: "status", codes: STATUSES.map((s) => s.code) },
      { name: "sex", codes: SEXES.map((s) => s.code) },
      { name: "year", codes: eraYears },
    ],
    ["pop"],
  );
  for (const r of eraRows) {
    for (const st of STATUSES) {
      for (const sx of SEXES) {
        era.set("pop", [st.code, sx.code, r.year], r.values[`${st.code}.${sx.code}`] ?? null);
      }
    }
  }
  console.log("era", eraYears[0], "–", eraYears.at(-1));

  // --- geo: area × status × year（国の年次一覧を積む）
  const byYear = new Map<string, CountryRow[]>();
  for (const y of years) {
    const rows = readCountries(y);
    byYear.set(y, rows);
    console.log("countries", y, rows.length);
  }

  const regionOf = new Map<string, RegionCode>();
  for (const y of [...years].reverse()) {
    for (const r of byYear.get(y)!) {
      if (r.region !== null && !regionOf.has(r.name)) regionOf.set(r.name, r.region);
    }
  }
  const latestNames = new Set(byYear.get(latest)!.map((r) => r.name));
  const allNames = new Set([...byYear.values()].flatMap((rows) => rows.map((r) => r.name)));
  const missing = [...allNames].filter((n) => !latestNames.has(n));
  if (missing.length > 0) console.log("最新年に無い国（表記ゆれなら COUNTRY_ALIASES へ）:", missing.join(", "));
  const unplaced = [...allNames].filter((n) => !regionOf.has(n));
  if (unplaced.length > 0) throw new Error(`地域が決まらない国: ${unplaced.join(", ")}`);

  const latestPop = new Map(byYear.get(latest)!.map((r) => [r.name, r.total ?? 0]));
  const countries = [...allNames]
    .map((name) => ({ code: name, label: name, region: regionOf.get(name)! }))
    .sort((a, b) => (latestPop.get(b.code) ?? -1) - (latestPop.get(a.code) ?? -1));

  const areas = [
    { code: WORLD.code, label: WORLD.label, level: 0, region: null },
    ...REGIONS.map((r) => ({ code: r.code, label: r.label, level: 1, region: null })),
    ...countries.map((c) => ({ ...c, level: 2 })),
  ];
  const geo = new Cube(
    [
      { name: "area", codes: areas.map((a) => a.code) },
      { name: "status", codes: STATUSES.map((s) => s.code) },
      { name: "year", codes: years },
    ],
    ["pop"],
  );
  const statusValue = (r: CountryRow, s: string) => (s === "total" ? r.total : s === "long" ? r.long : r.perm);
  for (const y of years) {
    const sums = new Map<string, number>();
    for (const r of byYear.get(y)!) {
      for (const st of STATUSES) {
        const v = statusValue(r, st.code);
        geo.set("pop", [r.name, st.code, y], v);
        const key = `${regionOf.get(r.name)}|${st.code}`;
        if (v !== null) sums.set(key, (sums.get(key) ?? 0) + v);
      }
    }
    for (const reg of REGIONS) {
      for (const st of STATUSES) geo.set("pop", [reg.code, st.code, y], sums.get(`${reg.code}|${st.code}`) ?? null);
    }
    for (const st of STATUSES) {
      const i = eraYears.indexOf(y);
      geo.set("pop", [WORLD.code, st.code, y], i < 0 ? null : (eraRows[i]!.values[`${st.code}.total`] ?? null));
    }
  }

  // --- detail: 2017年の職業・本人/家族・男女・年齢
  const table = readTable(DETAIL_YEAR);
  const detailAreas = [
    { code: WORLD.code, label: WORLD.label, level: 0, region: null as RegionCode | null, row: table.world },
    ...table.regions.map((r) => ({
      code: r.region!,
      label: REGIONS.find((x) => x.code === r.region)!.label,
      level: 1,
      region: null,
      row: r,
    })),
    ...table.countries
      .sort((a, b) => (b.values["total.all.total"] ?? 0) - (a.values["total.all.total"] ?? 0))
      .map((r) => ({ code: r.name, label: r.name, level: 2, region: regionOf.get(r.name) ?? r.region, row: r })),
  ];
  const groups = ["total", "perm", "long", ...OCCUPATIONS.map((o) => o.code)];
  const detail = new Cube(
    [
      { name: "area", codes: detailAreas.map((a) => a.code) },
      { name: "group", codes: groups },
      { name: "person", codes: PERSONS.map((p) => p.code) },
      { name: "sex", codes: SEXES.map((s) => s.code) },
    ],
    ["pop"],
  );
  const age = new Cube(
    [
      { name: "area", codes: detailAreas.map((a) => a.code) },
      { name: "age", codes: AGE_BANDS.map((b) => b.code) },
      { name: "sex", codes: SEXES.map((s) => s.code) },
    ],
    ["pop"],
  );
  for (const a of detailAreas) {
    for (const g of groups) {
      for (const p of PERSONS) {
        for (const s of SEXES) {
          detail.set("pop", [a.code, g, p.code, s.code], a.row.values[`${g}.${p.code}.${s.code}`] ?? null);
        }
      }
    }
    for (const b of AGE_BANDS) {
      for (const s of SEXES) age.set("pop", [a.code, b.code, s.code], a.row.values[`age.${b.code}.${s.code}`] ?? null);
    }
  }

  // --- cities: 最新年版の上位50都市（5年分）
  const cities = readCities(latest);

  const meta = {
    latestYear: latest,
    eraYears,
    geoYears: years,
    detailYear: DETAIL_YEAR,
    source: "外務省「海外在留邦人数調査統計」",
    sourceUrl: "https://www.mofa.go.jp/mofaj/toko/tokei/hojin/index.html",
  };

  const dict = { statuses: STATUSES, sexes: SEXES };
  writeFileSync(resolve(OUT, "era.json"), JSON.stringify({ ...dict, years: eraYears, ...era.toJSON() }));
  writeFileSync(
    resolve(OUT, "geo.json"),
    JSON.stringify({ ...dict, years, areas, cities, ...geo.toJSON() }),
  );
  writeFileSync(
    resolve(OUT, "detail.json"),
    JSON.stringify({
      year: DETAIL_YEAR,
      areas: detailAreas.map(({ row: _row, ...a }) => a),
      occupations: OCCUPATIONS.map(({ code, label }) => ({ code, label })),
      persons: PERSONS,
      sexes: SEXES,
      ages: AGE_BANDS.map(({ code, label }) => ({ code, label })),
      detail: detail.toJSON(),
      age: age.toJSON(),
    }),
  );
  writeFileSync(resolve(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("wrote", OUT);
  console.log("geo areas", areas.length, "filled", geo.filled("pop"));
  console.log("detail areas", detailAreas.length, "filled", detail.filled("pop"), "age", age.filled("pop"));
}

main();
