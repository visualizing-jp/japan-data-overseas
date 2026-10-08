import { Suspense } from "react";
import { EraView } from "./views/EraView.tsx";
import { GeoView } from "./views/GeoView.tsx";
import { WorkView } from "./views/WorkView.tsx";
import { useUrlState } from "./hooks/useUrlState.ts";
import { SeriesBar, SeriesFooter } from "./components/Brand.tsx";

const VIEWS = [
  { id: "era", label: "時代", hint: "1991–2025" },
  { id: "geo", label: "地域", hint: "国・都市" },
  { id: "work", label: "仕事", hint: "職業・年齢 2017" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function App() {
  const [view, setView] = useUrlState<ViewId>("view", "era", (v) => VIEWS.some((x) => x.id === v));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule bg-paper/85 backdrop-blur-sm">
        <SeriesBar />
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-end justify-between gap-4 px-6 pt-5">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">日本人は海外のどこに住んできたか</h1>
            <p className="text-[11px] text-muted">外務省「海外在留邦人数調査統計」</p>
          </div>
          <nav className="flex gap-1 -mb-px" aria-label="ビュー">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-current={view === v.id ? "page" : undefined}
                className={`cursor-pointer border-b-2 px-3 pt-1 pb-2 text-[13px] transition-colors duration-150 ${
                  view === v.id ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {v.label}
                <span className="ml-1.5 text-[10px] font-normal text-faint">{v.hint}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <Suspense key={view} fallback={<Loading />}>
        {view === "era" && <EraView />}
        {view === "geo" && <GeoView />}
        {view === "work" && <WorkView />}
      </Suspense>

      <footer className="mx-auto w-full max-w-[1240px] px-6 pt-2 pb-10 text-[11px] leading-relaxed text-faint">
        出典:{" "}
        <a
          href="https://www.mofa.go.jp/mofaj/toko/tokei/hojin/index.html"
          className="underline decoration-rule-strong underline-offset-2 hover:text-muted"
        >
          外務省「海外在留邦人数調査統計」
        </a>
        （各年版の統計表を e-Stat 経由で取得）。海外に3か月以上住む人のストック（ある時点の人数）で、旅行や出張の出国者数（延べ回数）とは別の数。どちらかがもう一方の内訳ではない。
        <SeriesFooter />
      </footer>
    </div>
  );
}

function Loading() {
  return <div className="mx-auto w-full max-w-[1240px] px-6 py-16 text-[12px] text-faint">読み込み中</div>;
}
