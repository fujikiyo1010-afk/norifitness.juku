---
name: preview-screen
description: 画面・モック・操作をきよむさんに確認してもらう時の出し方。目的=きよむさんにログインして確認する段取りをやめる。操作性/アニメ/遷移があるものはモック(public/mock/静的HTML)、見た目だけの比較・参考は静的(画像or静的HTML)。認証必須の生URLでログインさせない。
---

# 確認の見せ方

**目的: きよむさんに「ログインして確認する」段取りをさせない。** 認証必須画面の生URLを渡すと「スマホで開いてください」ゲートに当たる。どちらの手段もログイン不要。

## 使い分け
- **操作性・アニメーション・ページ遷移があるもの → モック**
  `public/mock/xxx.html`（静的HTML）を置き `http://localhost:3000/mock/xxx.html` を渡す。クリックで動く・遷移も再現・社員にも渡せる（home-design.html / hero-colors.html と同じ枠組み）。

- **見た目だけの比較・参考 → 静的（画像 or 静的HTML）**
  - 実データの現状を1枚見たい → スクショ: `node scripts/shot.mjs <path> <出力png> admin`（保存ログイン e2e/.auth/admin.json）→ PNGを Read で開いて貼る。切れていたら `npx playwright test --project=setup` で再生成。
  - デザイン案の比較 → 簡単な静的HTMLを /mock/ に置いてURLで渡す（複数案の並べ見せに向く）。

## 禁止
- 認証必須の生URL（/admin/* 等）を渡して「ログインして開いて」と丸投げ。
