# 🎓 筋肉塾 — のりfitness 新サイト

軸サービス「筋肉塾」の**サクセスラーニング型 学習プラットフォーム**。
現行ツール「エキスパ」のサイポン部分を、**Next.js + Supabase** で置き換える。

---

## 🎯 ゴール

- **生徒の実施完工率を最大化**する学習プラットフォーム
- 主軸: 生徒の学習継続・完工 / 副軸: 売上向上（間接効果）
- 完成目標: **2026年8月末**

## 📊 進行ステータス

| フェーズ | 内容 | 状態 |
|---|---|---|
| 0 | 前提条件抽出 + エキスパ完全理解 + 社長確認サマリー | ✅ 完了 |
| **1** | **骨組み設計（技術スタック、Supabase設計、MVP範囲確定）** | **🟡 進行中** |
| 2 | デザイン（参考サイト → ワイヤー → カンプ） | ⚪ 未着手 |
| 3 | 実装（フロント、Supabase連携、決済、テスト） | ⚪ 未着手 |
| 4 | 公開・運用（既存会員移行、エキスパ閉鎖判断） | ⚪ 未着手 |

---

## 🛠 技術スタック

| カテゴリ | 採用 |
|---|---|
| フロントエンド | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| 決済 | Stripe（直接、Webhook 受信のみ）|
| 動画 | Vimeo 埋め込み |
| メール | Resend |
| LINE | LINE Messaging API |
| ホスティング | Cloudflare Pages |
| ドメイン | juku.norifitness.com |

---

## 🚀 開発環境セットアップ

### 必要なもの
- Node.js 20 以上
- npm
- Supabase アカウント（プロジェクト作成済み）

### 手順

```bash
# 1. リポジトリに移動
cd 06_kinniku_juku_app

# 2. 依存パッケージインストール
npm install

# 3. 環境変数設定
cp .env.local.example .env.local
# → .env.local を編集して Supabase の URL/API キー等を記入

# 4. 開発サーバー起動
npm run dev
```

→ http://localhost:3000 でアクセス可能

### 環境変数（`.env.local`）
[`.env.local.example`](./.env.local.example) を参照。最低限 Supabase の3点が必要:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🗂 ディレクトリ構成

```
06_kinniku_juku_app/
├── README.md               ← このファイル
├── CLAUDE.md               ← Claude 用プロジェクト指示書（必読）
├── DO_NOT_DO.md            ← やらないことリスト
├── .env.local.example      ← 環境変数テンプレート
├── .env.local              ← 実値（.gitignore済、絶対コミット不可）
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind は v4 で PostCSS 設定経由
├── eslint.config.mjs
├── public/                 ← 静的ファイル
├── src/
│   ├── app/                ← App Router ページ
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/         ← 再利用可能なコンポーネント
│   │   └── ui/             ← UI コンポーネント（shadcn/ui 等、フェーズ2 で本格構築）
│   ├── lib/                ← ユーティリティ・クライアント
│   │   └── supabase/       ← Supabase クライアント
│   │       ├── client.ts   ← Browser Client
│   │       ├── server.ts   ← Server Client
│   │       └── middleware.ts ← セッション同期
│   ├── middleware.ts       ← Next.js Middleware（認証セッション同期）
│   └── types/              ← TypeScript 型定義
│       └── database.ts     ← Supabase テーブル型（自動生成予定）
└── docs/                   ← プロジェクトドキュメント
    └── 00_premises/        ← フェーズ0 成果物（14ファイル）
```

---

## 🛠 関係者

- **きよむさん**: 株式会社ボディチェンジャー社長の右腕、プロジェクト総括
- **のり社長**: のりfitness 代表、最終決定権者
- **Claude（参謀役）**: 抽出・構造化・実装の実行役

## 🔗 主要な情報源

- `../03_brain/memory/` — 構造化済みナレッジ（思想・人格・事業・顧客像 等）
- `docs/00_premises/` — フェーズ0 で抽出した前提条件・設計（14ファイル、3,500行超）
- 既存サイト: https://saipon.jp/h/dyz555/

## 📜 確定事項

| 項目 | 内容 |
|---|---|
| 役割 | サクセスラーニング型 学習プラットフォーム（サイポンの置き換え）|
| 決済 | Stripe で外部完結（新サイトは Webhook 受信のみ）|
| 招待 | 管理画面から手動招待（Supabase Auth）|
| trainercloud | 完全に別アプリ（連携機能なし）|
| MVP 機能 | 12機能（受講生8画面 + 管理者12画面）|
| DB | Supabase Postgres（16テーブル）|

詳細: [`docs/00_premises/phase0_summary.md`](./docs/00_premises/phase0_summary.md)

---

## 📚 ドキュメント早見表

| 何を知りたい? | ファイル |
|---|---|
| プロジェクト全体像 | [`docs/00_premises/phase0_summary.md`](./docs/00_premises/phase0_summary.md) |
| 事業背景・MVP範囲 | [`docs/00_premises/business_context.md`](./docs/00_premises/business_context.md) |
| 技術スタックの選定理由 | [`docs/00_premises/tech_stack_proposal.md`](./docs/00_premises/tech_stack_proposal.md) |
| DB スキーマ | [`docs/00_premises/database_design_draft.md`](./docs/00_premises/database_design_draft.md) |
| サイトマップ・画面遷移 | [`docs/00_premises/sitemap_draft.md`](./docs/00_premises/sitemap_draft.md) |
| フェーズ1 進め方 | [`docs/00_premises/phase1_kickoff_checklist.md`](./docs/00_premises/phase1_kickoff_checklist.md) |
| やらないこと | [`DO_NOT_DO.md`](./DO_NOT_DO.md) |
| Claude 向け指示 | [`CLAUDE.md`](./CLAUDE.md) |

---

## ⚙️ よく使うコマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint 実行
```

---

## 🔧 開発用スクリプト (scripts/)

### `seed_admin.js` — 管理者を admin_users に UPSERT (auth リセット時の保険)

`admin_users.id` は `auth.users(id)` を `on delete cascade` で参照しているため、
テスト中に Supabase Auth からユーザーを削除すると `admin_users` 行も道連れで消える。
そのまま放置すると `/admin/*` に誰も入れなくなる事故が起きるため、 復旧手段を script 化。

```bash
# 基本: きよむを superadmin で登録
node scripts/seed_admin.js fujikiyo1010@gmail.com きよむ superadmin

# 引数省略時 (name="管理者", role="superadmin")
node scripts/seed_admin.js fujikiyo1010@gmail.com

# 補助管理者を admin ロールで追加
node scripts/seed_admin.js secondary@example.com 補助管理者 admin
```

- UPSERT 方式 (onConflict: "id") = 何度実行しても安全
- 対象 email が `auth.users` に無ければエラー終了 (= 先に Auth でアカウント作る必要あり)
- DELETE しないので、 `admin_users.id` を FK 参照している他テーブル (`goal_sheets.reviewed_by` 等) と衝突しない

関連: [`DO_NOT_DO.md`](./DO_NOT_DO.md) `R-1` (素アドレスの auth 削除禁止)

---

詳細な進行ルール・抽出項目・リスク対策は [`CLAUDE.md`](./CLAUDE.md) を参照。
