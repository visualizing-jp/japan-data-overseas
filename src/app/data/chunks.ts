import { CubeView, type CubeJson, type DictEntry } from "./cube.ts";

function chunk<T, R>(url: string, map: (raw: T) => R): Promise<R> {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return map((await res.json()) as T);
  });
}

export interface Area extends DictEntry {
  level: number;
  /** 国のときだけ所属地域のコード。 */
  region: string | null;
}

export interface EraData {
  statuses: DictEntry[];
  sexes: DictEntry[];
  years: string[];
  cube: CubeView;
}

export interface CityRank {
  year: string;
  rows: { name: string; pop: number }[];
}

export interface GeoData {
  statuses: DictEntry[];
  years: string[];
  areas: Area[];
  cities: CityRank[];
  cube: CubeView;
}

export interface DetailData {
  year: string;
  areas: Area[];
  occupations: DictEntry[];
  persons: DictEntry[];
  sexes: DictEntry[];
  ages: DictEntry[];
  detail: CubeView;
  age: CubeView;
}

let eraP: Promise<EraData> | undefined;
let geoP: Promise<GeoData> | undefined;
let detailP: Promise<DetailData> | undefined;

export function loadEra(): Promise<EraData> {
  eraP ??= chunk<CubeJson & Omit<EraData, "cube">, EraData>("/data/era.json", (raw) => ({
    statuses: raw.statuses,
    sexes: raw.sexes,
    years: raw.years,
    cube: new CubeView(raw),
  }));
  return eraP;
}

export function loadGeo(): Promise<GeoData> {
  geoP ??= chunk<CubeJson & Omit<GeoData, "cube">, GeoData>("/data/geo.json", (raw) => ({
    statuses: raw.statuses,
    years: raw.years,
    areas: raw.areas,
    cities: raw.cities,
    cube: new CubeView(raw),
  }));
  return geoP;
}

export function loadDetail(): Promise<DetailData> {
  detailP ??= chunk<
    Omit<DetailData, "detail" | "age"> & { detail: CubeJson; age: CubeJson },
    DetailData
  >("/data/detail.json", (raw) => ({
    ...raw,
    detail: new CubeView(raw.detail),
    age: new CubeView(raw.age),
  }));
  return detailP;
}
