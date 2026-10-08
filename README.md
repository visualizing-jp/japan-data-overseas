# 日本人は海外のどこに住んできたか

外務省「海外在留邦人数調査統計」をもとに、海外に3か月以上住む日本人の数を
時代／地域／仕事の3つの切り口で探索するダッシュボード。

- 公開: https://japan-data-overseas.visualizing.jp/
- リポジトリ: https://github.com/visualizing-jp/japan-data-overseas

visualizing.jp スタンドアロン（dataviz.jp サブスクツールではない）。

## 開発

```bash
npm install
npm run fetch          # e-Stat から Excel を data/raw/ へ
npm run data           # public/data/*.json を生成
npm run verify
npm run dev
```

| スクリプト | 内容 |
| --- | --- |
| `npm run fetch` | e-Stat Excel 取得（`--force` で再取得） |
| `npm run data` | 配信用 Cube 構築 |
| `npm run verify` | 健全性チェック |
| `npm run dev` | Vite 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | TypeScript 検査 |

データ設計の正本は [`docs/data-sources.md`](docs/data-sources.md)。

## デプロイ

`main` への push で GitHub Pages にデプロイ（`.github/workflows/pages.yml`）。
カスタムドメインは `public/CNAME`（`japan-data-overseas.visualizing.jp`）。
Netlify 用設定も `netlify.toml` にあり。
