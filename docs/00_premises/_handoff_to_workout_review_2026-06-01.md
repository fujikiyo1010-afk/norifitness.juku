# チャット引き継ぎ書 ・ 筋トレメニュー実装フェーズ (レビューから)

**作成日**: 2026-06-01
**前回チャット**: 2026-05-28〜06-01 (筋トレデータ整備 → プロトタイプ検証 → 草案作成)
**用途**: 新チャットで「草案 4 ファイルのレビュー」から実装フェーズを続行
**最初の着手**: レビューポイント 1 (DB スキーマ SQL) の確認から

---

## 🎯 あなた (新チャット Claude) へのお願い

### 必須: 最初に順番に読むファイル

```
[ワークスペース横断]
1. /Users/f.kiyomu/Desktop/norifitness/CLAUDE.md
2. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/CLAUDE.md

[筋肉塾アプリ過去合意]
3. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_consolidated_agreements_2026-05-25.md
4. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_handoff_to_phase3_2026-05-25.md
5. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_chat_history_timeline_2026-05-25.md
6. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_handoff_to_chat6_2026-05-26.md
7. /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/00_premises/_handoff_to_chat8_2026-05-28.md
8. 本ファイル (_handoff_to_workout_review_2026-06-01.md)
```

### 必須: memory も読む (筋トレメニュー機能関連)

```
~/.claude/projects/-Users-f-kiyomu-Desktop-norifitness-01-tokuten/memory/
  - project_kinniku_juku_workout_menu.md      ← 新モデル方針 (過去事例検索)
  - project_kinniku_juku_workout_data_progress.md  ← 2026-06-01時点の進捗
  - project_kinniku_juku_admin_user_hub.md    ← ハブ画面・受信箱設計
  - project_kinniku_juku_goal_sheet_revamp.md ← 目標シート改修方針
  - project_kinniku_juku_drive_data_assets.md ← データ資産
  - project_kinniku_juku_app.md               ← プロジェクト全体
  - reference_trainer_cloud.md                ← 外部サービス
  - feedback_premise_change_check.md          ← 前提変更時の確認ルール
  - feedback_genshika_phase.md                ← 言語化フェーズの姿勢
```

読み終わったら **きよむさん** に挨拶して、本ファイル末尾の「最初に何をするか」に進んでください。

---

## 📍 現在地

**Phase 3 / 筋トレメニュー機能 新規実装フェーズ**

```
[完了]
├─ Drive データ整備 (カルテ263名 + 筋トレ277件)
├─ 統合データファイル作成 + きよむさん手動補完中
├─ workout_data.json 生成 (193件、3MB)
├─ Python プロトタイプ実装 + 回帰テスト
│  └─ 上位3件率 54.9% / 上位10件率 87.6%
├─ 設計確定 (ハブ画面・受信箱・カルテ方針)
└─ 草案 4 ファイル作成 (/tmp/06_implementation_drafts/)

[今ここ] レビューから再開
  ↓
[残作業]
├─ 草案 4 ファイル レビュー → きよむさん OK 後に 06_kinniku_juku_app/ に配置
├─ Supabase マイグレーション実行
├─ シードスクリプト実行 (workout_data.json → DB)
├─ カルテ入力 UI 実装 (受講生側)
├─ ハブ画面 UI 実装 (管理画面)
└─ マッチング動作確認 (本番環境)
```

---

## 🧭 確定した方針 (絶対遵守)

### 1. 新モデル = 過去事例検索 (旧軸テンプレ案は完全廃棄)

**経緯**: 当初「軸テンプレ性別2軸 + 部位レシピ5個 + 環境フィルタ」案だったが、2026-05-29 議論で全面廃棄。理由: のり氏の現状運用 (「過去や直近の人のスプシで似た特性の人を見つけて、少し変えて渡す」) を抽象化せずそのままシステム化する方が、目的 (のり氏作業効率化) に最短で到達。

```
[受講生 初回入力]
  ↓
完全選択式カルテ (9 項目)
  ↓
[システム] 全データ (277件、現在は193件確定) に対して機械マッチング
  優先度: 性別(F) > 重点部位(100) > 年齢(50) > 頻度(30) > 環境(30)
  ↓
[システム] 上位 3 件抽出 (1 位が最優先)
  ↓
[管理画面] のり氏が見る画面
  ├─ 上から: 1 位 → 2 位 → 3 位
  ├─ 横に: 受講生カルテ全項目 (機械 + 補助 両方)
  └─ 医師制限がある種目は「⚠ 注意」マーク
  ↓
[のり氏判断]
  ├─ 1 位を採用 (大半のケース)
  ├─ 2-3 位を選ぶ
  └─ 全部却下して手動検索 (稀)
  ↓
[微調整 → 配布]
```

### 2. カルテ構造

**機械マッチング用 (5項目)**:
1. 性別: 男 / 女 / その他
2. 生年月日 (→ 年齢層 自動計算)
3. 環境 (複数選択): 何もない / ダンベル / ベンチ / 懸垂機 / ジム / 家トレ
4. 理想頻度: 毎日コツコツ / 週6 / 週5 / 週4 / 週3 / 週2 / 任せる
5. 重点部位 (複数選択): 全身バランス / 腕 / 胸 / 背中 / 脚 / 腹筋 / 肩

**判断補助用 (4項目、機械マッチングには使わない、表示のみ)**:
6. 目的 (複数): ダイエット / 筋肉増 / 健康維持 / 体力向上 / 見た目改善
7. 運動経験: 全くない / たまに / 週次 / 毎日
8. 医師制限 (複数): なし / 腰痛 / 膝痛 / 心臓 / 高血圧 / その他
9. 目指す身体像: 健康+適度に筋肉 / 細マッチョ / マッチョ / 曲線美 / モデル体型

**カルテ編集**: 受講生 = read-only、のり氏 (管理者) = 編集可。受講生は「カルテ更新リクエスト」ボタンで依頼。

**機械マッチング項目変更時**: `menu_review_needed = true` フラグ立て (Trigger で自動)。**自動でメニュー上書きはしない**。のり氏がハブ画面で「メニュー見直し推奨」表示を見て手動対応。

### 3. テンプレ全件自動化

新規受講生にメニュー配布したら、自動で `workout_templates` テーブルに追加 (`source_user_id` で紐付け)。これによりデータ資産が日々増加 → マッチング精度向上。

### 4. 受信箱 = 2 つ + ハブ画面 1 つ

| 受信箱 | 中身 | 性質 |
|---|---|---|
| **月次添削受信箱** (既存) | 月次添削の提出 | 定期業務、独立 |
| **個別対応受信箱** (新規) | メニュー変更リクエスト + カルテ更新リクエスト | 不定期、明示的お願い |

⚠️ **目標シート更新通知は受信箱に出さない** (採用提案1)。理由: 受講生が編集するたびに通知が飛ぶとノイズ。ハブ画面の「最終更新日」サマリで状態表示する。

```
[月次添削受信箱] ──┐
                  │ → [ハブ画面] (受講生1人を完全把握)
[個別対応受信箱] ──┘
```

### 5. ハブ画面の表示パターン

**上部固定ヘッダー (採用提案2: デフォルト折りたたみ)**

判断順 4 ブロック:
1. **受講生像**: 👤 アバター + 名前 + 年齢性別 + ステータスチップ
2. **推移**: sparkline (5ヶ月分の体重/体脂肪/ウエスト)
3. **達成度**: 現在値 → 目標、達成%
4. **対応事項**: 🟡 カルテ変更→メニュー見直し推奨 等

**デフォルト**: 折りたたみ (1行サマリのみ)
**展開時**: 4ブロック詳細表示

→ B (sparkline) + D (達成度) + E (アバター+ステータス) のハイブリッド全部入り。

**新規受講生フォールバック** (採用提案3): データ無しの場合、別レイアウト。「初回カルテ入力完了 ✓」「月次添削は来月から」等を表示。

**本体**: 目標シート / メニュー / カルテ の 3 セクション (レイアウト微調整は実装時)。

### 6. 月次添削画面 (既存維持)

- 月次同期点モデル: 「目標シートも見直す?」「メニュー更新は必要?」のチェック欄あり (能動形)
- 上部に他セクションサマリ + ハブ画面への動線

### 7. マッチング重み付け (確定)

```
1. 性別:        フィルタ (異性除外、最強)
2. 重点部位:    100点 (body_strong モード、複数選択可)
3. 年齢層:      50点 (±1階層=30点、±2階層=10点)
─────────────── 上位3つ (きよむさん希望)
4. 頻度:        30点 (毎日系/高頻度系/中頻度系/低頻度系のカテゴリ判定)
5. 環境(器具):  30点 (家系/ジム系、不一致は-10点)
```

### 8. 自動化しないこと

- 「目標シート内容を読み解いて、どんなメニューがいいか判断」 = のり氏作業として残す (満足度の核)
- カルテ変更時のメニュー自動上書き = 禁止 (テンプレ上書きリスク)

---

## 📦 草案 4 ファイル (レビュー対象)

**場所**: `/tmp/06_implementation_drafts/`

| ファイル | 内容 | 行数 | 配置先 |
|---|---|---|---|
| `20260601000001_workout_system.sql` | 5 テーブル + RLS + Trigger | 251 | `06_kinniku_juku_app/supabase/migrations/` |
| `workout-types.ts` | TypeScript 型定義 | 202 | `06_kinniku_juku_app/src/lib/workout/types.ts` |
| `workout-matching.ts` | マッチング Server Action | 172 | `06_kinniku_juku_app/src/lib/workout/matching.ts` |
| `seed-workout-templates.ts` | workout_data.json → DB シード | 98 | `06_kinniku_juku_app/scripts/seed-workout-templates.ts` |

### マイグレーション SQL の中身 (テーブル一覧)

```
workout_templates       テンプレライブラリ
  - source_name, source_filename, source_user_id
  - gender, age_band, instrument, frequency, primary_body
  - cycles (jsonb), body_parts_main (jsonb), total_exercises, cycle_count
  - is_active, karte_match
  
user_workout_carte      受講生カルテ
  - gender, birth_date, age_band (generated column)
  - environments[], frequency_wish, focus_body_parts[]
  - purposes[], experience, medical_limits[], ideal_body
  - menu_review_needed (Trigger で自動セット)
  
user_workout_menu       配布済メニュー (履歴管理)
  - template_id, template_snapshot (テンプレ削除されても保護)
  - cycles, notes, effective_from, is_current
  
user_workout_request    メニュー変更リクエスト
user_carte_request      カルテ更新リクエスト
  - request_text, status (pending/in_progress/handled/dismissed)
  - handled_by, handled_at
```

**RLS**: 受講生は自分のカルテ・メニュー read のみ、リクエスト作成可、編集不可。管理者は全件操作可。

**Trigger**: `check_machine_field_changed()` - カルテの機械マッチング 5 項目が変わったら `menu_review_needed=true` に自動セット。

---

## 🔍 レビューポイント (きよむさんが見たい観点)

### レビュー 1: SQL のテーブル設計
- 列の漏れがないか
- 列名・型・check 制約の妥当性
- RLS ポリシーが意図通り (受講生 read-only、管理者編集可)
- Trigger ロジックの正しさ
- インデックス設計 (検索性能)

### レビュー 2: TypeScript 型定義
- カルテ 9 項目の表記が確定方針と一致しているか
- enum/union 型の値 (例: 「ダイエット」の文字列が UI と DB で一致)
- マッチング結果 (MenuCandidate) の構造
- ハブ画面用集約データ (UserHubData) の網羅性

### レビュー 3: マッチングロジック
- 重み値 (100/50/30/30) で本当に意図通りに動くか
- 「全身バランス」選択時の特殊判定 (偏り少ない=高評価)
- 環境マッチングの判定 (家系/ジム系の二分)
- 頻度カテゴリの境界 (毎日系/高頻度/中頻度/低頻度)

### レビュー 4: シードスクリプト
- 既存データを壊さない設計か (source_user_id IS NULL のみ削除)
- 環境変数取得の安全性
- バッチサイズ (50件) の妥当性
- 本番投入前の検証手順

---

## 📊 データ品質状況

| 対象 | 状態 |
|---|---|
| workout_data.json | **193件** 確定済 (3.0MB、`/Users/f.kiyomu/Desktop/07新サイト資料/workout_data.json`) |
| 残り 84件 | 性別 27 + 年齢層 79 が未補完 (`/Users/f.kiyomu/Desktop/統合データ_修正版.numbers`) |
| **後日対応** | きよむさんが補完 → `/tmp/build_workout_json_v2.py` 再実行で 277 件全部使える状態に |

### 回帰テスト結果 (Python プロトタイプ)
- 上位 3 件率: 54.9%
- 上位 10 件率: 87.6%
- 平均順位パーセンタイル: 4.2% (上位 4.2% に入る)
- 圏外 (性別フィルタで除外): 0 件

---

## 👤 きよむさんのスタイル (memory より、特に大事なもの)

- **ですます調**、「！」は適度に
- **噛み砕いた説明・比喩を歓迎** (家の鍵、シェアハウス等)
- **要点先出し、不足なければ長文OK**、末尾の「短く/普通/詳しく」選択肢は添えない
- **言語化フェーズでは決定を急がない** (「言語化してほしい」と言われたら articulation に徹する、決定迫る質問で締めない)
- **決裁が要る判断は確認** (お金/UX/スコープ/本番運用)
- **管理画面 UX は Claude 判断 OK** (`/admin/*` は事前確認スキップ)
- **受講生側 UI は別扱い** (要相談)
- **前提を変える時は Claude から明示確認** ([[feedback_premise_change_check]])
- **セキュリティリスク回避を優先** (鍵の権限最小化、削除は Dashboard 経由)
- **bypass モード中も怪しい操作は事前確認**
- **過去決定見落とし禁止** (提案前に CLAUDE.md/README.md/DO_NOT_DO.md/docs/00_premises/ 全部確認)

---

## ⚠️ 重要な注意事項

### git/ファイル系
- `06_kinniku_juku_app` は **独立 git リポジトリ**
- workspace 側 git は触らない
- `.env.local` は VS Code 直接編集 or `read -s` (チャットに貼らない)

### データ系
- カルテ・筋トレファイルは **個人情報含む** (氏名・住所・生年月日)
- 統合データファイル (Numbers) は **きよむさん補完中**、勝手に触らない
- バックアップ: `/Users/f.kiyomu/Desktop/統合データ_修正版_backup.numbers`

### 既存実装との関係
- 月次添削画面 (`/admin/monthly-reviews`) は既に実装済 (Phase 3)
- ハブ画面は **月次添削個別画面を拡張する形** で実装するのが自然
- 既存合意 (合意の正典) に矛盾する変更は **明示確認** ([[feedback_premise_change_check]])

---

## 🚀 新チャット冒頭で最初にやること

1. **必読ファイル全て読む** (上記 8 ファイル + memory 9 ファイル)
2. **きよむさんに挨拶**
3. **草案 4 ファイルを Read で内容確認**:
   - `/tmp/06_implementation_drafts/20260601000001_workout_system.sql`
   - `/tmp/06_implementation_drafts/workout-types.ts`
   - `/tmp/06_implementation_drafts/workout-matching.ts`
   - `/tmp/06_implementation_drafts/seed-workout-templates.ts`
4. **レビューポイント 1 (SQL) から議論開始**
   - きよむさんに「SQL のここをまず見たい」と提案
   - 列の妥当性、RLS、Trigger を順に確認
5. **OK ならファイル配置** → 次のレビューポイントへ進む
6. レビュー全部終わったら → マイグレーション実行 → シードスクリプト実行 → UI 実装フェーズへ

### 挨拶テンプレ案

```
おはようございます (こんにちは)、きよむさん。

引き継ぎ書 + 必読ファイル + memory 全て読み込みました。

[現在地]
筋トレメニュー機能の実装フェーズ。設計確定済み、草案 4 ファイル作成済み。
今から「レビューポイント 1 = DB スキーマ SQL」のレビューから再開します。

最初に SQL の中身をきよむさんと一緒に確認します。気になる点があればこの時点で指摘してください。それでは Read で SQL を開きます。
```

---

## 🔒 守るべき決定事項 TOP 15

1. 新モデル = 過去事例検索。**旧軸テンプレ案は完全廃棄**
2. マッチング重み: 性別(F) > 重点部位(100) > 年齢(50) > 頻度(30) > 環境(30)
3. 上位 3 件提示、1 位が最優先
4. カルテ受講生 = read-only、のり氏 = 編集可
5. 機械マッチング項目変更時は menu_review_needed フラグのみ (自動上書き禁止)
6. 全件自動テンプレ化 (新規メニューも workout_templates に追加)
7. テンプレ感は絶対出さない (受講生 UI で常に「○○さんの今月のメニュー」)
8. 実行記録 = 新サイト持たず、トレーナークラウドに委ねる
9. 受信箱は **月次添削** + **個別対応** の 2 つ
10. 目標シート更新通知は受信箱に出さない (ノイズ回避)
11. ハブ画面の上部ヘッダーはデフォルト折りたたみ
12. 新規受講生フォールバック表示あり
13. データ品質要件: 性別・年齢 95%+ (補完で達成)
14. 月次添削画面は既存維持、月次同期点モデルあり
15. 「のり氏の判断を自動化しない」原則 (目標シート読み解き等)

---

## 📁 重要な参照ファイル一覧

```
[草案ファイル (レビュー対象)]
/tmp/06_implementation_drafts/20260601000001_workout_system.sql
/tmp/06_implementation_drafts/workout-types.ts
/tmp/06_implementation_drafts/workout-matching.ts
/tmp/06_implementation_drafts/seed-workout-templates.ts

[データファイル]
/Users/f.kiyomu/Desktop/07新サイト資料/workout_data.json           # 193件メニューデータ
/Users/f.kiyomu/Desktop/07新サイト資料/カルテ/初回カルテ筋肉塾.xlsx   # 217名
/Users/f.kiyomu/Desktop/07新サイト資料/カルテ/初回カルテ.xlsx        # 46名
/Users/f.kiyomu/Desktop/07新サイト資料/直接指導生徒　個別トレーニングメニュー/  # 277件xlsx
/Users/f.kiyomu/Desktop/統合データ_修正版.numbers                    # きよむさん補完中

[Python ツール (参考)]
/tmp/build_master_v5.py                  # 統合データ生成 (再実行可)
/tmp/build_workout_json_v2.py            # JSON出力 (補完後再実行)
/tmp/match_prototype.py                  # マッチングプロトタイプ
/tmp/match_v2_body_focus.py              # 重点部位フォーカス検証
/tmp/regression_test.py                  # 回帰テスト

[既存実装 (Phase 3)]
06_kinniku_juku_app/src/app/admin/monthly-reviews/        # 月次添削管理画面
06_kinniku_juku_app/src/app/goal-sheet/                  # 目標管理シート (改修対象)
06_kinniku_juku_app/src/app/monthly-review/              # 月次添削 受講生UI
06_kinniku_juku_app/supabase/migrations/                  # 既存マイグレーション
```

---

## 💬 きよむさんに最初に確認すべきこと

引き継ぎ書を読み終えたら、以下を確認してから草案レビューに入る:

1. 「現在地」と「次の作業」の認識合っているか
2. 草案 4 ファイルを **レビュー 1 (SQL) → 2 (型) → 3 (マッチング) → 4 (シード)** の順で進めて OK か
3. 残りカルテ補完 (性別 27 + 年齢層 79) は **後日対応** で OK か
4. その他、引き継ぎ書に書かれていない疑問があるか

---

**以上、引き継ぎ書終了**

きよむさんの作業効率と、Phase 3 完成までの最短ルートを意識しつつ進めてください。
セキュリティ・品質・きよむさんの判断尊重 を最優先に。

頑張ってください。
