# フェーズ1 着手チェックリスト

**作成日**: 2026-05-19
**目的**: フェーズ1（骨組み設計 + 開発環境構築）を始める前の準備リスト
**進め方**: チェックボックスを順番に埋めながら進める

---

## 🎯 フェーズ1 で達成すること

> 「**動く骨組み**」を作る = ログインしてマイページが表示される最小限のアプリ。

### フェーズ1 完了の条件
- [ ] Next.js プロジェクトが起動する
- [ ] Supabase に接続できる
- [ ] 招待メール → パスワード設定 → ログイン → マイページ表示
- [ ] 管理画面に管理者ログインできる
- [ ] DB の基本テーブル（users / user_profiles 等）が作成済み
- [ ] Cloudflare Pages にデプロイされ、公開 URL でアクセス可能

→ ここまでで「**サクセスラーニング型の土台**」が出来上がる。
→ ここからフェーズ2（デザイン）→ フェーズ3（実装）に進んで MVP 完成。

---

## 📋 準備チェックリスト（3カテゴリ）

### 🔵 A. きよむさんが必要なアカウント作成（フェーズ1 着手前に）

私が代行できないもの。きよむさんが各サービスでアカウント作成 + 設定。

| # | サービス | 何をするか | 推定時間 |
|---|---|---|---|
| A-1 | **Supabase** | アカウント作成 → 新規プロジェクト作成（リージョン: Tokyo 推奨）→ URL と API キーを控える | 10分 |
| A-2 | **Cloudflare** | 既存アカウント利用 → 新規 Pages プロジェクト作成 | 5分 |
| A-3 | **Resend** | アカウント作成 → API キー取得 → ドメイン認証（後で）| 10分 |
| A-4 | **Stripe Dashboard** | 既存アカウント利用 → Webhook エンドポイントの URL は私が作った後に設定 | 5分（後でOK）|
| A-5 | **ドメイン** | `norifitness.com` のサブドメインを決定 → Cloudflare DNS で設定 | 10分 |

→ 詳細手順は **A-1 から順番に**ご案内します。一気にやる必要なし。

---

### 🟢 B. 私が単独でできること（きよむさんは見るだけ）

きよむさん作業と並行で、私が進められるもの。

| # | 作業 | 内容 |
|---|---|---|
| B-1 | **Next.js プロジェクト初期化** | `npx create-next-app@latest` で雛形作成 |
| B-2 | **TypeScript + Tailwind CSS セットアップ** | デフォルト設定で OK |
| B-3 | **shadcn/ui セットアップ** | 美しい UI コンポーネント（モダンサイトの定番）|
| B-4 | **フォルダ構造整備** | src/app, src/components, src/lib, src/types 等 |
| B-5 | **Supabase クライアント雛形** | `@supabase/supabase-js` インストール、設定ファイル準備 |
| B-6 | **環境変数テンプレ** | `.env.local.example` に必要な変数を列挙 |
| B-7 | **Git リポジトリ整備** | フェーズ0 のドキュメントは残しつつ、Next.js プロジェクトを追加 |
| B-8 | **CLAUDE.md / README.md 更新** | フェーズ1 着手内容を反映 |
| B-9 | **Supabase マイグレーション SQL 作成** | database_design_draft.md を SQL に変換 |

→ きよむさんが A-1〜A-3 完了したら、B-5 で接続テスト可能。

---

### 🟡 C. フェーズ1 で順次決める残課題

フェーズ1 着手中に確定すれば OK。

| # | 項目 | 決定方法 |
|---|---|---|
| C-1 | **サブドメイン名**（app/juku/learn/members/site 等）| きよむさん決定 |
| C-2 | **リバウンド保証の正確な規定** | 社長確認 or 既存資料から |
| C-3 | **受講生マスタの実体的な所在** | きよむさん調査 |
| C-4 | **個別面談予約ツールの最終選定** | きよむさん判断（Calendly / TimeRex 等）|

---

## 🚦 フェーズ1 進行フロー（おすすめ順序）

### Day 1（今日 or 次回）: 環境構築の基礎
- A-1 Supabase アカウント作成（きよむさん）
- B-1〜B-2 Next.js + TypeScript + Tailwind セットアップ（私）
- B-7 Git 整備（私）

### Day 2: フロントエンド土台
- B-3 shadcn/ui セットアップ（私）
- B-4 フォルダ構造（私）
- B-5 Supabase クライアント設定 + 接続テスト（私 + きよむさん）

### Day 3〜: 認証フロー実装
- B-9 マイグレーション SQL（私）→ Supabase 適用
- 認証画面の実装（ログイン・パスワード設定）
- 招待メール送信フロー（Resend）

### Day 4〜: コンテンツ閲覧の骨組み
- DB シードデータ投入（既存コース・章・レッスン）
- マイページ・コンテンツ一覧の最低限実装

### Day 5〜: Cloudflare Pages デプロイ
- 初回デプロイ
- 公開 URL でアクセス確認

→ **1〜2週間で「動く骨組み」が完成**する想定。

---

## 📝 きよむさんへの最初のお願い

フェーズ1 を始めるにあたって、**最初にやってほしいこと**:

### Step 1. Supabase アカウント作成（10分）
1. https://supabase.com/ にアクセス
2. 「Start your project」→ GitHub / Google でログイン
3. 「New project」→ プロジェクト名: `kinniku-juku` 等
4. リージョン: **Tokyo (Northeast Asia)** を推奨
5. データベースパスワード: 強力なものを設定（後で必要）
6. プロジェクト作成完了 → 設定画面の URL と API キー（anon key + service_role key）を**メモ**

→ メモした情報は、後で `.env.local` に書き込みます（チャットには貼らない）。

### Step 2. サブドメイン名を決める
新サイトの URL を何にしますか？

- ☐ `app.norifitness.com`
- ☐ `juku.norifitness.com`
- ☐ `learn.norifitness.com`
- ☐ `members.norifitness.com`
- ☐ `site.norifitness.com`
- ☐ その他: ___

→ 決まり次第、Cloudflare で DNS 設定 + Cloudflare Pages にバインド。

### Step 3. 報告
Supabase 作成完了 + サブドメイン名決定したら教えてください。
そこから私が Next.js プロジェクト初期化（B-1）を始めます。

---

## ⚠️ 注意事項

### セキュリティ
- Supabase API キーは **チャットに直接貼らない**
- `.env.local` ファイルに書き込む（`.gitignore` 済）
- 共有が必要な場合は **1Password / Bitwarden 経由**を推奨

### git の扱い
- `06_kinniku_juku_app/` は独立 git リポジトリ
- フェーズ0 のドキュメントはそのまま残し、Next.js プロジェクトを追加
- コミットは段階ごとにきよむさんの承認を得てから

---

## 🔗 関連ファイル

- 技術スタック詳細: [`tech_stack_proposal.md`](./tech_stack_proposal.md)
- DB 設計詳細: [`database_design_draft.md`](./database_design_draft.md)
- サイトマップ詳細: [`sitemap_draft.md`](./sitemap_draft.md)
- フェーズ0 完了報告: [`phase0_summary.md`](./phase0_summary.md)

---

## 🎯 まとめ

### きよむさんへの最初のお願い（簡潔版）
1. **Supabase アカウント作成**（10分）
2. **サブドメイン名を決める**（5分）
3. 完了したら声をかけてください

→ そこから一気に開発環境が立ち上がります。
