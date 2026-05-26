# Phase 3 実装チャットへの引き継ぎ書

**作成日**: 2026-05-25
**作成者**: メインチャット Claude (Phase 2-7 デザイン言語化担当)
**用途**: 新しいチャット (Phase 3 実装担当) に渡すための「全部入り」引き継ぎ書

---

## 🎯 あなたへのお願い (Phase 3 担当 Claude へ)

あなたは **筋肉塾新サイト構築プロジェクト Phase 3 実装** の参謀役です。

### 必須: 最初に読むファイル (この順番で)

```
1. /Users/f.kiyomu/Desktop/norifitness/CLAUDE.md
   → ワークスペース全体規約 (依頼者・文体・禁止事項)

2. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/CLAUDE.md
   → プロジェクト指示書 (進行ルール・コスト管理・セキュリティ)

3. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_consolidated_agreements_2026-05-25.md
   → 合意の正典 (全合意事項の集約、これが最も重要)

4. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/DO_NOT_DO.md
   → やらないことリスト (スコープ膨張防止)

5. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/README.md
   → 現在実装済の構造 + 開発手順
```

### 必ず守るルール (過去の Claude が失敗したパターン)

- ✅ **提案前に必ず合意の正典を Read する** (新規提案より既存決定の確認が先)
- ✅ **既存ドキュメントは編集禁止、新規ファイルのみ作成** (合意の正典は読み取り専用扱い、追記は事前確認)
- ✅ **「過去に決めた」と言われたら、まず docs/00_premises/ を grep する**
- ❌ **過去の合意を見落とすな** (Next.js のバージョン / ホスティング / 動画方式など、過去ドキュメントに書いてある)
- ❌ **「これで進めます」と勝手に走り出すな** (お金 / UX / スコープ / 本番運用 は事前確認)

---

## 📌 プロジェクト基本情報

| 項目 | 内容 |
|---|---|
| プロジェクト名 | 筋肉塾新サイト構築 (`06_kinniku_juku_app/`) |
| 軸サービス | 筋肉塾 (現行サイポンの置き換え) |
| 操作者 | きよむさん (のりfitness 社員、社長右腕、プロジェクト完全一任) |
| 最終承認者 | のり社長 (株式会社ボディチェンジャー代表) |
| 主軸 KPI | 受講生の実施完工率 |
| 副軸 | 売上向上 |
| 完成目標 | 2026 年 8 月末 (※ ただし機能優先、出来次第方針に変更済) |
| 受講生規模 | 現状 アクティブ 48 人 + 退会 250 人 (動画なし) |
| 受講料金 | 一括買い切り (月額なし) |

---

## 📍 現在地 (Phase 2-7 完了時点)

```
Phase 0  [完了 2026-05-19]  前提条件抽出 + エキスパ調査 + 社長確認
Phase 1  [完了 2026-05-25]  骨組み設計 + 技術スタック確定 + 環境構築
Phase 2  [完了 2026-05-25]  デザイン (Phase 2-1〜2-7 全完了)
Phase 3  [これから着手 ←]   実装 (フロント + Supabase 連携 + テスト)
Phase 4  [予定]             公開・運用 (既存会員移行 + エキスパ閉鎖)
```

### Phase 2-7 (デザイン言語化フェーズ) で完成したもの

**27 枚のモックファイル** (`/tmp/` 配下、`/tmp/mocks_index.html` で一覧):

| カテゴリ | ファイル | 数 |
|---|---|---|
| ホーム | home_v4.html | 1 |
| 目標シート | goal_sheet_v3.html / goal_sheet_overview.html | 2 |
| 月次添削 (受講生) | monthly_review_form / complete / history / detail | 4 |
| 月次添削 (管理) | admin_monthly_inbox / review / record | 3 |
| 体組成記録 (MVP 外、保管) | body_metrics.html | 1 |
| ツール (インディゴ配色) | tools_index / body_fat / calorie / diet_period / pfc_carb | 5 |
| オンボーディング系 | boot_loading / empty_state / error_screen / onboarding | 4 |
| 祝福演出 | chapter_complete / course_complete / graduation_complete | 3 |
| 第 3 弾 | search_screen / settings_screen / profile_screen | 3 |
| 旧モック (参考用) | (廃止予定、保管中) | - |
| **合計** | | **26 (+ graduation = 27)** |

### Phase 2-7 で確定したデザイン方針

- Nike エッセンス (影なし、グレー罫線 `#e8ebe9`、余白広め)
- メインカラー: ティール緑 `#00897b` / `#00695c` / `#004d40`
- ツール群のみ: インディゴ `#3949ab`
- 添削系: 薄黄 + 名前色 `#b8860b`
- 温かいグラデ: `linear-gradient(135deg, #e0f2f1, #fffbe6)` (起動・章末・コース完了・全課程完了)
- 角丸 14px (一般) / 4px (機能ブロック・ツールボタン) / 20px (モーダル)
- **アイコンは線画黒一色 SVG (Lucide / Heroicons outline) に統一** ← 絵文字禁止、例外は ✓ ▶ のみ
- 下部タブ 5 項目: ホーム / コース / 記録 / 検索 / 設定
- ロゴ: 「筋肉塾」のみ (のりfitness 表記なし)
- のり社長呼称: 「のりfitness」(× のり社長)
- キャラクター画像: `06_kinniku_juku_app/public/images/nori-character.png` (4 箇所のみ使用)

---

## 🛠 確定済み技術スタック (変更不可)

| カテゴリ | 採用 | 確定日 |
|---|---|---|
| フロントエンド | Next.js 16.2.6 (App Router) + React 19 + TypeScript | 2026-05-19 |
| スタイリング | Tailwind CSS v4 | 2026-05-19 |
| バックエンド | Supabase (PostgreSQL + Auth + Storage、Pro $25/月) | 2026-05-19 |
| ホスティング | Cloudflare Pages (Vercel ではない) | 2026-05-19 |
| 動画 | Vimeo 埋め込み (Supabase Storage ではない) | 2026-05-18 |
| 決済 | Stripe (外部完結、Webhook 受信のみ) | 2026-05-18 |
| メール | Resend | 2026-05-19 |
| LINE | LINE Messaging API | 2026-05-18 |
| ドメイン | juku.norifitness.com | 2026-05-25 |

### 既に実装済の要素 (`06_kinniku_juku_app/`)

- `package.json` (next 16.2.6, react 19.2.4, @supabase/ssr, supabase-js, resend, tailwindcss v4)
- `src/lib/supabase/` (client.ts / server.ts / middleware.ts)
- `src/middleware.ts` (認証セッション同期)
- `supabase/` (マイグレーション置き場)
- `.env.local.example` (Supabase キー 3 点 + 他)

→ Phase 3 では **このひな形に肉付けする** 形で実装を進める (ゼロから作り直さない)。

---

## 📦 拡張 MVP スコープ (15 機能 / 20 テーブル / 38 画面)

### 機能リスト
| ID | 機能 | 区分 | 新規テーブル |
|---|---|---|---|
| M-1 | 認証 | MVP | — |
| M-2 | コンテンツ閲覧 (Vimeo) | MVP | — |
| M-3 | 段階公開 | MVP | — |
| M-4 | 学習進捗の可視化 | MVP | — |
| M-5 | マイページ | MVP | — |
| M-6 | LINE サポート連携 | MVP | — |
| M-7 | コメント機能 | MVP | — |
| M-8 | 試験機能 | MVP | — |
| M-9 | 管理画面 (9 画面) | MVP | — |
| M-10 | 目標管理シート ★ (体組成手入力欄含む) | MVP | — |
| M-11 | オンボーディング動線 | MVP | — |
| M-12 | 簡易 FAQ | MVP | — |
| **M-13** | **月次添削 (動画返信、LINE 廃止)** | **NEW MVP** | `monthly_audits` |
| **M-14** | **ツール 4 種** | **NEW MVP** | `tool_calculations` |
| **M-15** | **祝福演出 (章末 / コース完了 / 全課程完了)** | **NEW MVP** | — (UI のみ) |

### 画面数
- 受講生: 23 画面 (既存 11 + 月次添削 4 + ツール 5 + 祝福 3)
- 管理者: 15 画面 (既存 12 + 月次添削管理 3)

### MVP 対象外
- 体組成記録の独立画面 (体重ログは trainercloud 完結、目標シート ① に手入力欄統合)
- カーボサイクル「今日の目安」表示 (機能自体削除、週次表のみ保持)
- noriAI 連携 (Should Have / Phase 4 候補)
- 修了証 PDF サーバー生成 (MVP は html2canvas クライアント生成)
- Stripe Webhook 自動招待 (MVP は手動、Should Have で自動化)
- trainercloud SSO 連携 (永久に別アプリ)

---

## 🗄 DB スキーマ (既存 18 + 新規 2 = 20 テーブル)

詳細は `database_design_draft.md` (既存 18 テーブルの完全 CREATE TABLE) + `/tmp/phase_3_mvp_classification_and_db.html` (新規 2 テーブル設計) を参照。

### 既存 18 テーブル (`database_design_draft.md`、変更なし)
users / user_profiles / courses / chapters / lessons / lesson_progress / comments / goal_sheets / goal_sheet_revisions / tests / test_attempts / admin_users / invitations / stripe_events / broadcast_notifications / notifications / user_status_history / faqs / faq_categories / graduate_voices

### 新規 2 テーブル (CREATE TABLE は /tmp/phase_3_mvp_classification_and_db.html 参照)
- `monthly_audits` (月次添削、17 項目 jsonb + Vimeo URL、UNIQUE user × target_month)
- `tool_calculations` (ツール計算、4 ツール、UNIQUE user × tool で最新値のみ保存)

### 既存 1 テーブルの jsonb 構造拡張 (マイグレーション不要)
- `goal_sheets.content` を 5 セクション構造に拡張: ① 現状把握 (体重/身長/ウエスト/首回り/体脂肪率) / ② 目標選定 / ③ 栄養設計 (PFC + カーボサイクル) / ④ プラス感情ゴール / ⑤ セルフイメージ改善

### RLS ポリシー
- 受講生は自分の行のみ、管理者は全行 (詳細 /tmp/phase_3_api_design.html セクション 3)

---

## 🔌 API 設計

詳細: `/tmp/phase_3_api_design.html` (9 セクションの完全仕様)

### 中心思想
**Supabase PostgREST が「DB を直接 HTTP で叩ける」仕組み** を持つため、Next.js 側のカスタム API は最小化。

### カスタム API ルート (たった 4 つ)
- `POST /api/stripe/webhook` (Stripe Webhook 受信、署名検証)
- `POST /api/line/notify` (LINE プッシュ通知送信)
- `POST /api/vimeo/upload` (Vimeo アップロード Proxy)
- `POST /api/email/send` (Resend メール送信)

### データアクセスパターン
- **Server Component**: サーバー側で Supabase に直接クエリ (推奨、SSR + SEO)
- **Client Component**: ブラウザ側で Supabase JS SDK (インタラクション)

---

## 🎬 動画運用フロー (重要、合意の正典セクション 6-B 参照)

### 1 文サマリ
**のり氏が管理画面の 1 画面で録画 (MediaRecorder) → 送信ボタン押下で Vimeo にアップロード → URL を Supabase DB に保存 → 受講生に通知 → 受講生は Vimeo Player で視聴 → 永久保存 + 退会者は RLS で権限切るだけ**

### データ保存先
| データ | 保存先 |
|---|---|
| 動画ファイル本体 | **Vimeo** (Supabase Storage ではない) |
| 動画 URL の文字列 | Supabase DB の `monthly_audits.nori_video_vimeo_url` |
| 17 項目テキスト + 回答 | Supabase DB の `monthly_audits.items` (jsonb) |

---

## 🔐 認証・招待・退会フロー

- **招待**: 管理者が `/admin/invitations/new` で発行 → Resend で 48h 有効リンクメール → 受講生がパスワード設定 → 自動ログイン
- **ログイン**: メアド + パスワード (Supabase Auth)
- **退会**: セルフ解約なし。管理者が手動でステータス変更、動画は永久保存 (RLS でアクセス権切る)
- **再入会**: status を 'active' に戻すだけで全動画再閲覧可能

---

## 💳 決済フロー

- **新サイト内に決済画面なし** (DO_NOT_DO.md 確定)
- 受講生は新サイト外で決済 (Stripe 決済リンク / 銀行振込)
- 完了後、管理者が手動でアカウント発行 (現状の手動運用継続)
- Stripe Webhook 受信 → `stripe_events` テーブルに記録 → 管理者に通知 (MVP) / 自動招待 (Should Have)

---

## 🧪 技術検証結果 (Phase 2-7 で実施済)

| # | 検証 | 結論 | ファイル |
|---|---|---|---|
| 1 | html2canvas (修了証 PNG) | scale=2 + fonts.ready 待機で本番採用 OK | /tmp/tech_check_html2canvas.html |
| 2 | MediaRecorder (動画録画) | コーデック auto + MP4 優先で Safari/Chrome 両対応 | /tmp/tech_check_mediarecorder.html |
| 3 | Supabase Pro 試算 | 受講生 500 人くらいまで $25/月で安定 (動画は Vimeo のため Storage 圧迫なし) | /tmp/tech_check_supabase_pro.html |
| **4** | **Vimeo API 連携 (予定)** | **Phase 3 着手時に追加検証** | (未作成) |

---

## 📁 ディレクトリ構成 (Phase 3 で構築する形)

```
06_kinniku_juku_app/
├── src/
│   ├── app/
│   │   ├── (auth)/                ← ログイン・招待・リセット
│   │   ├── (student)/             ← 受講生向け 23 画面
│   │   │   ├── home/
│   │   │   ├── goal-sheet/        ← 編集 / 閲覧モード
│   │   │   ├── monthly-review/    ← 月次添削 4 画面
│   │   │   ├── tools/             ← 4 ツール + 一覧
│   │   │   ├── graduation/        ← 全課程完了
│   │   │   ├── search/
│   │   │   ├── settings/
│   │   │   └── profile/
│   │   ├── admin/                 ← 管理画面 12-15 画面
│   │   └── api/                   ← カスタム API 4 つ
│   │       ├── stripe/webhook/
│   │       ├── line/notify/
│   │       ├── vimeo/upload/
│   │       └── email/send/
│   ├── components/
│   ├── lib/
│   │   ├── supabase/              ← 既に実装済
│   │   └── ...
│   └── types/
├── public/
│   └── images/
│       └── nori-character.png     ← 既に配置済
├── supabase/
│   └── migrations/                ← Phase 3 で 20 テーブル分作成
└── docs/00_premises/              ← 既に 17 + 2 ファイル
```

---

## 🚀 Phase 3 着手の最初の数日 (推奨順)

### Day 1: 環境準備
1. このファイル + 合意の正典 + 関連ドキュメントを完全読み込み
2. `06_kinniku_juku_app/` で `npm install` + `npm run dev` で開発サーバー起動確認
3. Supabase プロジェクト作成 (Pro $25/月、きよむさんがアカウント準備)
4. `.env.local` に Supabase URL / Anon Key / Service Role Key 設定

### Day 2-3: DB セットアップ
5. マイグレーション SQL 作成 (既存 18 + 新規 2 テーブル)
6. RLS ポリシー実装
7. Storage バケット作成 (profile-avatars / comment-images / lesson-thumbnails)
8. シードデータ作成 (既存コース・章・レッスンの登録)

### Day 4-5: 認証フロー
9. ログイン画面実装
10. 招待リンク → パスワード設定フロー
11. パスワードリセット

### Day 6 以降: 画面実装 (モック → React 移植)
12. ホーム画面 (home_v4.html → src/app/(student)/home/page.tsx)
13. 主要画面 1 つずつ実装 (毎日 1-2 画面のペース)
14. テスト + デプロイ

### 並行: Tech Check 4 (Vimeo API 連携検証)
- アップロード自動化、メタ取得、URL 生成の検証

---

## ⚠️ 絶対に外してはいけない決定事項 (TOP 10)

1. 新サイトは Stripe で決済外部完結 ← 申込/決済/返金機能なし
2. trainercloud は永久に別アプリ・別管理 ← SSO 連携不可
3. 主軸 KPI は「生徒の実施完工率」
4. 目標管理シート = 最初に設定 → いつでも見れる → 編集可能
5. MVP 機能は 15 (既存 12 + Phase 2-7 追加 3) で確定
6. 動画は Vimeo (Supabase Storage ではない)
7. ホスティングは Cloudflare Pages (Vercel ではない)
8. ドメインは juku.norifitness.com
9. DO_NOT_DO.md は封印 (フェーズ1 終了時に確定)
10. 既存コンテンツ構造 (5 コース / 22 章 / 217 レッスン) + Vimeo URL は継承 (再撮影なし)

---

## 📚 参照ドキュメント完全リスト

### 必読 (Phase 3 着手時)
- `06_kinniku_juku_app/CLAUDE.md` ― プロジェクト指示書
- `06_kinniku_juku_app/README.md` ― 現状の技術スタック + 開発手順
- `06_kinniku_juku_app/DO_NOT_DO.md` ― やらないことリスト
- `06_kinniku_juku_app/docs/00_premises/_consolidated_agreements_2026-05-25.md` ― **合意の正典 (必読)**
- `06_kinniku_juku_app/docs/00_premises/database_design_draft.md` ― 既存 18 テーブルの完全定義
- このファイル `_handoff_to_phase3_2026-05-25.md`

### 詳細参照
- `06_kinniku_juku_app/docs/00_premises/tech_stack_proposal.md` ― 技術選定理由
- `06_kinniku_juku_app/docs/00_premises/business_context.md` ― 事業背景 + MVP 範囲
- `06_kinniku_juku_app/docs/00_premises/sitemap_draft.md` ― サイトマップ + 画面遷移
- `06_kinniku_juku_app/docs/00_premises/phase0_summary.md` ― Phase 0 完了報告
- `06_kinniku_juku_app/docs/00_premises/phase1_kickoff_checklist.md` ― Phase 1 着手手順
- `06_kinniku_juku_app/docs/00_premises/_pending_confirmations.md` ― 確認待ち事項一覧

### モック + 検証ファイル (/tmp/ 配下)
- `/tmp/mocks_index.html` ― 全 27 モックの一覧 (実装時のリファレンス)
- `/tmp/tech_check_html2canvas.html` ― Tech Check 1
- `/tmp/tech_check_mediarecorder.html` ― Tech Check 2 (受講生プレビュー含む)
- `/tmp/tech_check_supabase_pro.html` ― Tech Check 3 (インタラクティブ試算)
- `/tmp/phase_3_stack_reaffirm.html` ― 技術スタック再評価
- `/tmp/phase_3_mvp_classification_and_db.html` ― MVP 分類 + 統合 DB スキーマ
- `/tmp/phase_3_api_design.html` ― API 設計 (9 セクション)

### Claude メモリ (`~/.claude/projects/-Users-f-kiyomu-Desktop-norifitness-01-tokuten/memory/`)
- `MEMORY.md` ― 全メモリの索引
- `project_kinniku_juku_app.md` ― プロジェクト進捗履歴
- `project_kinniku_juku_phase_2_7_design.md` ― デザイン言語化の合意
- `project_kinniku_juku_content_structure.md` ― 5 コース / 22 章 / 217 レッスン
- `project_kinniku_juku_tech_stack_confirmed.md` ― 技術スタック (合意の正典への参照ハブ)
- `project_norifitness_payment_flow.md` ― 決済フロー
- `project_norifitness_jisou_philosophy.md` ― 事業思想
- `feedback_check_past_decisions_first.md` ― 提案前ドキュメント確認ルール
- `feedback_icon_svg_over_emoji.md` ― アイコンは SVG (絵文字禁止)
- `feedback_decision_check.md` ― 決裁が要る判断は事前確認
- `feedback_admin_ux.md` ― 管理画面 UX は Claude 判断 OK
- `user_kiyomu.md` ― きよむさんプロフィール

---

## 📝 きよむさんとの会話スタイル (重要)

- ですます調、「!」は適度
- きよむさんを「きよむさん」と呼ぶ、一人称「私」
- 要点先出し、不足なければ長文 OK、末尾の「短く/普通/詳しく」選択肢は不要
- 比喩歓迎 (家の鍵、書類棚等)
- 噛み砕いた説明を歓迎
- 決裁が要る判断 (お金 / UX / スコープ / 本番運用) は事前確認
- 実装の細部 (コード品質・セキュリティ・ファイル構成) は Claude 判断 OK
- 管理画面 UX は Claude 判断 OK、受講生側 UI は事前確認
- リサーチチャット成果 (`docs/02_research/` 等) は素材扱い、鵜呑み禁止

---

**引き継ぎ完了**: 2026-05-25
**次の Claude へ**: 上記の必読ドキュメントを順番に読んでから、きよむさんに「Phase 3 実装の準備が整いました、何から始めますか?」と挨拶してください。
