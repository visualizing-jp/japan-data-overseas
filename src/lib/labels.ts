/** 外務省の地域区分・在留区分・職業区分。 */

export const REGIONS = [
  { code: "asia", label: "アジア", match: "アジア" },
  { code: "oceania", label: "大洋州", match: "大洋州" },
  { code: "namerica", label: "北米", match: "北米" },
  { code: "camerica", label: "中米", match: "中米" },
  { code: "samerica", label: "南米", match: "南米" },
  { code: "weurope", label: "西欧", match: "西欧" },
  { code: "eeurope", label: "東欧・旧ソ連", match: "東欧" },
  { code: "mideast", label: "中東", match: "中東" },
  { code: "africa", label: "アフリカ", match: "アフリカ" },
  { code: "antarctica", label: "南極", match: "南極" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

export const WORLD = { code: "world", label: "全世界" } as const;

export function regionFromLabel(label: string): RegionCode | null {
  const s = label.replace(/\s+/g, "");
  return REGIONS.find((r) => s.includes(r.match))?.code ?? null;
}

export const STATUSES = [
  { code: "total", label: "総数" },
  { code: "long", label: "長期滞在者" },
  { code: "perm", label: "永住者" },
] as const;

export const SEXES = [
  { code: "total", label: "計" },
  { code: "male", label: "男" },
  { code: "female", label: "女" },
] as const;

/** 長期滞在者の職業区分（本人の職業。同居家族は本人の区分に入る）。 */
export const OCCUPATIONS = [
  { code: "private", label: "民間企業関係者", match: "民間企業" },
  { code: "academic", label: "留学生・研究者・教師", match: "留学生" },
  { code: "freelance", label: "自由業関係者", match: "自由業" },
  { code: "government", label: "政府関係職員", match: "政府関係" },
  { code: "press", label: "報道関係者", match: "報道" },
  { code: "other", label: "その他", match: "その他" },
] as const;

export const PERSONS = [
  { code: "all", label: "計" },
  { code: "self", label: "本人" },
  { code: "family", label: "同居家族" },
] as const;

export const AGE_BANDS = [
  { code: "u20", label: "20歳未満", match: "二十歳未満" },
  { code: "20s", label: "20歳代", match: "二十歳代" },
  { code: "30s", label: "30歳代", match: "三十歳代" },
  { code: "40s", label: "40歳代", match: "四十歳代" },
  { code: "50s", label: "50歳代", match: "五十歳代" },
  { code: "60plus", label: "60歳以上", match: "六十歳以上" },
] as const;

/**
 * 年によって国名の表記が違うもの。左を右（最新の表記）にそろえる。
 * build が「最新年に無い国」を一覧するので、増えたらここに足す。
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  グルジア: "ジョージア",
  スワジランド: "エスワティニ",
  マケドニア旧ユーゴスラビア: "北マケドニア",
  マケドニア旧ユーゴスラビア共和国: "北マケドニア",
  北マケドニア共和国: "北マケドニア",
  マケドニア: "北マケドニア",
  "北マリアナ諸島（米領-在サイパン事）": "北マリアナ諸島（米領-サイパン）",
  "グアム（在ハガッニャ総領事館）": "グアム（米領）",
  グアム: "グアム（米領）",
  "アルバ島（蘭領）": "アルバ（蘭領）",
  "キュラカオ島（蘭領）": "キュラソー（蘭領）",
  "キュラカオ（蘭領）": "キュラソー（蘭領）",
  "セントマーティン島（蘭領）": "セントマーティン（蘭領）",
  "グァドループ島（仏領）": "グアドループ（仏領）",
  "マルティニーク島（仏領）": "マルティニーク（仏領）",
  "レ・ユニオン（仏領）": "レユニオン（仏領）",
  セントクリストファー・ネーヴィス: "セントクリストファー・ネービス",
  イスラエル及びガザ地区等: "イスラエル",
  イスラエル及び西岸・ガザ地区等: "イスラエル",
  カーボヴェルデ: "カーボベルデ",
  マラウィ: "マラウイ",
};

/** 半角カナ・全角英数・全角ハイフンは NFKC でそろえ、括弧だけ全角に戻す。注記（※…）は落とす。 */
export function normalizeCountry(raw: string): string {
  const s = raw
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）")
    .replace(/（?[※＊*].*$/, "");
  return COUNTRY_ALIASES[s] ?? s;
}
