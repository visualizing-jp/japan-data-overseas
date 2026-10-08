/**
 * e-Stat から海外在留邦人数調査統計の Excel を data/raw/ へ取得する。
 * 年 → statInfId は scripts/catalog.json。新しい年は
 * https://www.e-stat.go.jp/stat-search/files?layout=dataset&toukei=00300100 で ID を確かめて足す。
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW = resolve(import.meta.dirname, "../data/raw");
const CATALOG = resolve(import.meta.dirname, "catalog.json");

async function download(year: string, id: string, force: boolean): Promise<void> {
  const out = resolve(RAW, `${year}.xlsx`);
  if (!force && existsSync(out)) {
    console.log("skip", year);
    return;
  }
  const url = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${id}&fileKind=0`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 japan-data-overseas" } });
  if (!res.ok) throw new Error(`${res.status} ${year}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log("ok", year, statSync(out).size);
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const force = process.argv.includes("--force");
  const catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as Record<string, string>;
  for (const [year, id] of Object.entries(catalog)) {
    await download(year, id, force);
  }
  console.log("done", Object.keys(catalog).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
