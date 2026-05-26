> ⚠️ **このファイルは非推奨です（2026-05-19 にマーク）**
>
> このファイルは「コーチング型サービス」を前提に書かれたもので、筋肉塾の実際の前提（**サクセスラーニング型 学習プラットフォーム**）とズレています。
>
> **正規のスキーマは [database_design_draft.md](../00_premises/database_design_draft.md)（16テーブル）**を参照してください。実装も `supabase/migrations/20260519000001_initial_schema.sql` で既に適用済みです。
>
> 本ファイルは参考用に残しますが、新規参照は推奨しません。

---

# 08 Supabase テーブル設計 第1稿（非推奨）

**作成日**: 2026-05-19
**スコープ**: 筋肉塾 会員サイト ([07_wireframe_members.md](07_wireframe_members.md)) を支えるデータ構造
**形式**: マークダウン表（後で SQL DDL 化 / Supabase migration 化）
**前提**: Supabase（PostgreSQL + Auth + Storage + Realtime）を利用

---

## 0. 設計方針

| 方針 | 内容 |
|---|---|
| 主キー | `id` は `uuid` (gen_random_uuid()) を基本 |
| タイムスタンプ | `created_at`, `updated_at` を全テーブルに（タイムゾーン込み `timestamptz`） |
| 認証 | Supabase Auth (`auth.users`) と紐付けは `auth_id`（FK） |
| 削除 | 物理削除を基本（必要に応じて soft delete カラム追加） |
| RLS | 全テーブルで Row Level Security 有効化前提（後段で詳細） |
| ストレージ | 画像・動画は Supabase Storage、URL は `text` 型で保持 |

---

## 1. 全体構成（テーブル一覧）

| # | テーブル名 | 役割 | 関連画面 |
|---|---|---|---|
| 1 | `users` | 受講生のプロフィール | 全画面 |
| 2 | `cohorts` | 期生（同期グループ） | ホーム・仲間 |
| 3 | `memberships` | 入会・支払い・在籍状態 | マイ・設定 |
| 4 | `lessons` | 学習コンテンツのマスタ | 学習 |
| 5 | `lesson_progress` | 受講生×レッスンの進捗 | 学習・ホーム |
| 6 | `meals` | 食事ログ（写真・PFC） | 食事 |
| 7 | `meal_feedbacks` | コーチからの食事フィードバック | 食事 |
| 8 | `body_records` | 体重・体脂肪率の記録 | マイ |
| 9 | `photos` | ビフォーアフター写真 | マイ |
| 10 | `posts` | コミュニティ投稿 | 仲間 |
| 11 | `post_comments` | 投稿へのコメント | 仲間 |
| 12 | `post_reactions` | いいね・スタンプ | 仲間 |
| 13 | `questions` | 質問スレッド（レッスン関連 / コミュニティ） | 学習・仲間 |
| 14 | `question_answers` | 質問への回答 | 学習・仲間 |
| 15 | `conversations` | チャットの会話単位 | チャット |
| 16 | `messages` | チャットメッセージ | チャット |
| 17 | `events` | ライブ配信・合宿等のイベント | ホーム・仲間 |
| 18 | `notifications` | プッシュ通知・お知らせ | ヘッダー🔔 |
| 19 | `integrations` | HealthKit / Google Fit 連携状態 | マイ・設定 |
| 20 | `audit_logs` | 操作ログ（管理用） | （管理画面） |

---

## 2. 個別テーブル詳細

### 2.1 `users` — 受講生プロフィール

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `auth_id` | `uuid` | NO | Supabase Auth の users.id（FK） |
| `email` | `text` | NO | メールアドレス（UNIQUE） |
| `display_name` | `text` | NO | 表示名（「きよむ」等） |
| `full_name` | `text` | YES | 本名 |
| `phone` | `text` | YES | 電話番号 |
| `avatar_url` | `text` | YES | アバター画像URL |
| `birthdate` | `date` | YES | 生年月日 |
| `gender` | `text` | YES | 性別（任意） |
| `height_cm` | `numeric(5,1)` | YES | 身長 |
| `target_weight_kg` | `numeric(5,1)` | YES | 目標体重 |
| `target_body_fat_pct` | `numeric(4,1)` | YES | 目標体脂肪率 |
| `pfc_target_protein` | `int` | YES | 目標タンパク質(g) |
| `pfc_target_fat` | `int` | YES | 目標脂質(g) |
| `pfc_target_carb` | `int` | YES | 目標炭水化物(g) |
| `timezone` | `text` | NO | デフォルト `Asia/Tokyo` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `auth_id` (UNIQUE), `email` (UNIQUE)

---

### 2.2 `cohorts` — 期生（同期グループ）

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `name` | `text` | NO | 「2026春期生」等 |
| `start_date` | `date` | NO | 開始日 |
| `end_date` | `date` | NO | 卒業予定日 |
| `total_weeks` | `int` | NO | 例: 24 |
| `mentor_user_id` | `uuid` | YES | 担当のり氏 or 講師のFK |
| `description` | `text` | YES | 紹介文 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### 2.3 `memberships` — 入会・支払い・在籍状態

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `cohort_id` | `uuid` | NO | FK → cohorts.id |
| `status` | `text` | NO | `active` / `completed` / `refunded` / `cancelled` |
| `enrolled_at` | `timestamptz` | NO | 入会日時 |
| `completed_at` | `timestamptz` | YES | 卒業日時 |
| `cancelled_at` | `timestamptz` | YES | 解約日時 |
| `total_amount_jpy` | `int` | NO | 契約総額（例: 327800） |
| `payment_method` | `text` | NO | `lump_sum` / `installment_X` |
| `installment_count` | `int` | YES | 分割回数 |
| `notes` | `text` | YES | 備考 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, cohort_id)` UNIQUE

---

### 2.4 `lessons` — 学習コンテンツのマスタ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `cohort_id` | `uuid` | YES | 期固定 or 共通（NULLなら共通） |
| `week_no` | `int` | NO | 第何週 |
| `sequence` | `int` | NO | 同一週内の順序 |
| `title` | `text` | NO | レッスンタイトル |
| `description` | `text` | YES | 概要 |
| `video_url` | `text` | YES | 動画URL（Vimeo/Mux/Storage） |
| `video_duration_sec` | `int` | YES | 動画秒数 |
| `worksheet_url` | `text` | YES | PDFワークシート |
| `release_offset_days` | `int` | NO | 期開始日から何日後に解禁か |
| `is_published` | `boolean` | NO | 公開フラグ |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `(cohort_id, week_no, sequence)`

---

### 2.5 `lesson_progress` — 受講生×レッスンの進捗

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `lesson_id` | `uuid` | NO | FK → lessons.id |
| `watched_seconds` | `int` | NO | デフォルト 0 |
| `last_position_sec` | `int` | NO | 再生位置記憶 |
| `completed_at` | `timestamptz` | YES | 完了日時 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, lesson_id)` UNIQUE

---

### 2.6 `meals` — 食事ログ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `meal_type` | `text` | NO | `breakfast` / `lunch` / `dinner` / `snack` |
| `eaten_at` | `timestamptz` | NO | 食事日時 |
| `photo_url` | `text` | NO | Supabase Storage 上の写真URL |
| `description` | `text` | YES | 任意のメモ |
| `protein_g` | `numeric(6,2)` | YES | タンパク質（AIまたは手入力） |
| `fat_g` | `numeric(6,2)` | YES | 脂質 |
| `carb_g` | `numeric(6,2)` | YES | 炭水化物 |
| `calories_kcal` | `int` | YES | カロリー |
| `pfc_source` | `text` | NO | `ai` / `manual` / `coach_corrected` |
| `ai_confidence` | `numeric(3,2)` | YES | AI判定の信頼度（0-1） |
| `is_public_to_cohort` | `boolean` | NO | 同期に見せるか（デフォルト false） |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, eaten_at)`, `(user_id, meal_type, eaten_at::date)` UNIQUE で1日1食種別=1件強制（重複時は更新）

---

### 2.7 `meal_feedbacks` — コーチからの食事フィードバック

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `meal_id` | `uuid` | NO | FK → meals.id |
| `coach_user_id` | `uuid` | NO | FK → users.id（コーチ） |
| `content` | `text` | NO | フィードバック本文 |
| `rating` | `text` | YES | `good` / `ok` / `needs_improvement` |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `meal_id`（1食につき複数フィードバック可だが通常1）

---

### 2.8 `body_records` — 体重・体脂肪率の記録

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `recorded_at` | `timestamptz` | NO | 記録日時 |
| `weight_kg` | `numeric(5,1)` | YES | 体重 |
| `body_fat_pct` | `numeric(4,1)` | YES | 体脂肪率 |
| `muscle_mass_kg` | `numeric(5,1)` | YES | 筋肉量 |
| `source` | `text` | NO | `manual` / `healthkit` / `google_fit` |
| `created_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, recorded_at)`

---

### 2.9 `photos` — ビフォーアフター写真

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `photo_url` | `text` | NO | Storage URL |
| `taken_at` | `date` | NO | 撮影日 |
| `category` | `text` | NO | `front` / `side` / `back` |
| `weight_kg` | `numeric(5,1)` | YES | 撮影時の体重（任意） |
| `is_public_to_cohort` | `boolean` | NO | 同期に見せるか |
| `created_at` | `timestamptz` | NO | |

---

### 2.10 `posts` — コミュニティ投稿

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `cohort_id` | `uuid` | NO | FK → cohorts.id |
| `author_user_id` | `uuid` | NO | FK → users.id |
| `content` | `text` | NO | 本文 |
| `photo_urls` | `text[]` | YES | 添付写真URLの配列 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |
| `deleted_at` | `timestamptz` | YES | soft delete |

**インデックス**: `(cohort_id, created_at DESC)`

---

### 2.11 `post_comments` — 投稿へのコメント

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `post_id` | `uuid` | NO | FK → posts.id |
| `author_user_id` | `uuid` | NO | FK → users.id |
| `content` | `text` | NO | コメント本文 |
| `is_pinned` | `boolean` | NO | のり氏コメントのピン留め |
| `created_at` | `timestamptz` | NO | |

---

### 2.12 `post_reactions` — いいね・スタンプ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `post_id` | `uuid` | YES | FK → posts.id（投稿への反応） |
| `comment_id` | `uuid` | YES | FK → post_comments.id（コメントへの反応） |
| `user_id` | `uuid` | NO | FK → users.id |
| `reaction_type` | `text` | NO | `like` / `fire` / `clap` 等 |
| `created_at` | `timestamptz` | NO | |

**制約**: `post_id` と `comment_id` のいずれか1つだけ NOT NULL
**インデックス**: `(post_id, user_id, reaction_type)` UNIQUE

---

### 2.13 `questions` — 質問スレッド

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `cohort_id` | `uuid` | NO | FK → cohorts.id |
| `lesson_id` | `uuid` | YES | FK → lessons.id（レッスン関連質問） |
| `author_user_id` | `uuid` | NO | FK → users.id |
| `title` | `text` | NO | 質問タイトル |
| `body` | `text` | NO | 質問内容 |
| `is_resolved` | `boolean` | NO | 解決済みフラグ |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### 2.14 `question_answers` — 質問への回答

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `question_id` | `uuid` | NO | FK → questions.id |
| `author_user_id` | `uuid` | NO | FK → users.id |
| `content` | `text` | NO | 回答本文 |
| `is_official_answer` | `boolean` | NO | のり氏 or 講師の公式回答か |
| `created_at` | `timestamptz` | NO | |

---

### 2.15 `conversations` — チャットの会話単位

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `type` | `text` | NO | `direct`（1on1）/ `cohort_group` |
| `cohort_id` | `uuid` | YES | グループチャットの場合 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

---

### 2.16 `messages` — チャットメッセージ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `conversation_id` | `uuid` | NO | FK → conversations.id |
| `sender_user_id` | `uuid` | NO | FK → users.id |
| `content_type` | `text` | NO | `text` / `image` / `video` |
| `content` | `text` | YES | テキスト本文 |
| `media_url` | `text` | YES | 画像・動画URL |
| `read_by` | `uuid[]` | YES | 既読ユーザーIDの配列 |
| `sent_at` | `timestamptz` | NO | |

**インデックス**: `(conversation_id, sent_at DESC)`

---

### 2.17 `events` — ライブ配信・合宿等のイベント

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `cohort_id` | `uuid` | YES | 期限定イベント or NULL=共通 |
| `type` | `text` | NO | `live_stream` / `camp` / `meetup` |
| `title` | `text` | NO | |
| `description` | `text` | YES | |
| `scheduled_at` | `timestamptz` | NO | |
| `duration_min` | `int` | YES | |
| `location` | `text` | YES | 「Zoom」「沖縄」等 |
| `meeting_url` | `text` | YES | Zoom URL等 |
| `replay_url` | `text` | YES | アーカイブURL |
| `created_at` | `timestamptz` | NO | |

---

### 2.18 `notifications` — プッシュ通知・お知らせ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `type` | `text` | NO | `meal_feedback` / `coach_message` / `event` / `lesson_release` |
| `title` | `text` | NO | |
| `body` | `text` | YES | |
| `link_url` | `text` | YES | アプリ内遷移先 |
| `read_at` | `timestamptz` | YES | 既読日時 |
| `created_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, created_at DESC)`, `(user_id, read_at)` where read_at IS NULL

---

### 2.19 `integrations` — HealthKit / Google Fit 連携

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | NO | FK → users.id |
| `provider` | `text` | NO | `apple_health` / `google_fit` |
| `is_authorized` | `boolean` | NO | 認可済みか |
| `authorized_at` | `timestamptz` | YES | |
| `last_synced_at` | `timestamptz` | YES | 最後の同期日時 |
| `metadata` | `jsonb` | YES | プロバイダー固有設定 |
| `created_at` | `timestamptz` | NO | |
| `updated_at` | `timestamptz` | NO | |

**インデックス**: `(user_id, provider)` UNIQUE

---

### 2.20 `audit_logs` — 操作ログ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | `uuid` | NO | 主キー |
| `user_id` | `uuid` | YES | 操作者（システム操作なら NULL） |
| `action` | `text` | NO | `created_meal` / `gave_feedback` 等 |
| `target_table` | `text` | YES | 対象テーブル |
| `target_id` | `uuid` | YES | 対象レコード |
| `metadata` | `jsonb` | YES | 詳細 |
| `created_at` | `timestamptz` | NO | |

---

## 3. RLS (Row Level Security) の方針

Supabase ではテーブル毎に RLS を ON にし、ポリシーで「誰がどのレコードにアクセス可能か」を定義する。

**基本パターン**:

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` | 本人 + 同期メンバー（表示名のみ）+ 管理者 | 本人のみ | 本人のみ | 管理者のみ |
| `meals` | 本人 + 担当コーチ + 管理者 | 本人のみ | 本人のみ | 本人のみ |
| `meal_feedbacks` | 食事の所有者 + コーチ + 管理者 | コーチのみ | コーチのみ | コーチのみ |
| `posts` | 同期メンバー + 管理者 | 同期メンバーのみ | 著者のみ | 著者 + 管理者 |
| `messages` | 会話の参加者のみ | 参加者のみ | 送信者のみ | 送信者 + 管理者 |
| `lessons` | 在籍中のメンバー（解禁日以降） | 管理者のみ | 管理者のみ | 管理者のみ |

→ Step 3.5 で詳細ポリシー化（次フェーズ）

---

## 4. 開発・運用上の留意点

| 項目 | 内容 |
|---|---|
| マイグレーション | Supabase CLI でバージョン管理 |
| ストレージバケット | `meal-photos`（限定公開）, `avatars`（パブリック）, `lesson-videos`（限定公開） |
| Realtime | `messages`, `post_comments`, `notifications` で有効化 |
| バックアップ | Supabase の Daily Backup を有効化（Pro プラン） |
| インデックスメンテ | `meals`, `messages` は時系列クエリ多数 → 適切なインデックス必須 |

---

## 5. 既存システム（エキスパ）からの移行

エキスパ → Supabase 移行時に取り込みが必要なデータ:

| エキスパ側 | Supabase 側 | 備考 |
|---|---|---|
| 受講生情報 | `users` + `memberships` | パスワードは再設定（招待リンク経由） |
| 過去のレッスン視聴ログ | `lesson_progress` | 取れる範囲で |
| 過去の食事ログ | `meals` | 写真がある場合は Storage 移行 |
| 体重記録 | `body_records` | |

→ 移行スクリプトは別途設計

---

## 6. 次のステップ

1. **本ドキュメントをのり氏・きよむさんでレビュー**（テーブル過不足の確認）
2. **動線整理（別チャット）の成果物と突き合わせ**（画面遷移と整合性確認）
3. **Supabase migration ファイルへの落とし込み**（SQL DDL 化）
4. **RLS ポリシーの詳細設計**（誰が何にアクセスできるか）
5. **API（PostgREST / Edge Functions）の設計**

---

## 7. 関連ドキュメント

- [05_design_inspiration.md](05_design_inspiration.md) — UI要素のいいとこどり整理
- [07_wireframe_members.md](07_wireframe_members.md) — 会員サイトの画面設計
- [00_premises/sitemap_draft.md](../00_premises/sitemap_draft.md) — 既存のサイトマップ案
- [00_premises/tech_stack_proposal.md](../00_premises/tech_stack_proposal.md) — 技術スタック前提
