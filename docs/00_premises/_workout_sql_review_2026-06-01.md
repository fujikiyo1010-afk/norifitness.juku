# 筋トレメニュー機能 草案レビュー作業ログ

**作成日**: 2026-06-01
**チャット**: 筋肉塾7 (workout 草案レビュー)
**前チャット**: 筋肉塾6 (草案作成 + 引き継ぎ書作成)
**作業時間**: 約 2-3 時間
**結論**: 草案 4 ファイル → 修正版 6 ファイルに再構築して配置完了。本番影響ゼロ (配置前に発見)

---

## 経緯

筋肉塾6 (前チャット) が引き継ぎ書 + 草案 4 ファイルを作成。本チャットでレビューしたところ、既存スキーマとの不整合が複数発覚。配置前に修正版を作成して置き換えた。

**前チャット草案の場所**: `/tmp/06_implementation_drafts/` (4 ファイル)
**本チャット修正版の場所**: `/tmp/06_implementation_drafts_v2/` (6 ファイル) → 各正規パスにコピー済

---

## なぜ不整合が出たか (原因分析)

引き継ぎ書 8 ファイル + memory 9 ファイルは **「設計判断とその理由」** を完璧に書いていたが、**「既存スキーマの細部 (`is_admin()` 関数、`admin_users` 別テーブル、`set_updated_at()` 共通関数、`user_profiles.birthday` の存在)」** は書かれていなかった。

そのため、前チャット Claude は設計通りの SQL を書いたが、書き方が「一般的な Supabase の書き方」になっていて、本プロジェクト固有のヘルパー関数と乖離した。

**設計合意は揺らいでいない**。揺らいだのは「実装の細部が既存と揃っているか」のチェックだけ。

---

## 発見した不整合と修正方針

### SQL (`20260601000001_workout_system.sql`)

| # | 不整合 | 修正 |
|---|---|---|
| 1 | RLS が `users.role = 'admin'` で書かれていた (列が存在せず動かない) | `public.is_admin()` ヘルパー関数を使用 |
| 2 | `handled_by` が `public.users(id)` (受講生マスタ) 参照 | `public.admin_users(id)` 参照に変更 |
| 3 | `updated_at` の更新方法が独自実装、3 テーブルに Trigger 漏れ | 既存共通 `public.set_updated_at()` Trigger を統一適用 |
| 4 | `birth_date` が `user_profiles.birthday` と二重管理 | **案 C 採用**: `user_profiles.birthday` を正、カルテに `birth_date` / `age_band` を持たず TS 側で `calcAgeBand` 計算 |
| 5 | `text[]` 比較が `!=` (NULL 安全でない) | `IS DISTINCT FROM` に変更 |

### 型定義 (`workout-types.ts` → `src/lib/workout/types.ts`)

| # | 不整合 | 修正 |
|---|---|---|
| A1 | 案 C 適用未反映 | `birth_date` 削除、`calcAgeBand` ヘルパー関数追加 |
| B1 | `interface` 多用 (既存は `type` 統一) | 全部 `export type` に |
| B2 | DB レコード型に `Row` サフィックスなし | `WorkoutTemplate` → `WorkoutTemplateRow` 等 |
| B3 | `medical_limits` に「なし」値あり (空配列と二重) | 「なし」削除、空配列で表現 |
| B4 | 補助関数ゼロ (既存は 7-8 個) | `calcAgeBand`, `classifyEnvironment`, `classifyFrequency`, `isCarteMachineReady`, `hasCurrentMenu`, `ageBandDistance` 等追加 |
| B5 | `UserHubData.recent_metrics` の時系列が不明瞭 | `months: string[]` 配列を追加、`weights: (number \| null)[]` で未測定月を null 表現 |

### マッチング (`workout-matching.ts` → 4 ファイルに分割)

| # | 不整合 | 修正 |
|---|---|---|
| C1 | 1 ファイルに「読み取り + 純粋関数 + 空関数」が同居 | **4 ファイル分割**: `types.ts` / `matching.ts` / `queries.ts` / `actions.ts` |
| C2 | エラー処理が `throw new Error()` (既存は戻り値型) | `{ ok: true; ... } \| { ok: false; message: string }` 戻り値型に統一 |
| C3 | Server Action 群が存在しない (カルテ保存・メニュー配布・リクエスト対応がない) | `actions.ts` に `saveCarteAsAdmin`, `distributeMenu`, `createCarteRequest`, `createWorkoutRequest`, `handleCarteRequest`, `handleWorkoutRequest`, `clearMenuReviewFlag` を追加 |
| C4 | 案 C 適用未反映 (`carte.age_band` が NULL になる) | `getCarteForAdmin` で `user_profiles.birthday` を JOIN して age_band を計算 |
| C5 | `select("*")` 多用 (既存は列名明示) | `TEMPLATE_COLS`, `CARTE_COLS`, `MENU_COLS` 等の定数で列明示 |
| D4 | 空関数 `getUserHubData` あり | 削除 (UI 実装フェーズで追加予定) |

### シードスクリプト (`seed-workout-templates.ts` → `seed_workout_templates.js`)

| # | 不整合 | 修正 |
|---|---|---|
| E1 | `.ts` (ESM) で `tsx` 依存 (既存は `.js` CommonJS) | `.js` (CommonJS) に書き換え、`node --env-file=.env.local` で実行 |
| E2 | ファイル名 kebab-case (既存は snake_case) | `seed_workout_templates.js` |
| E3 | JSON パスがハードコード | `WORKOUT_JSON` 環境変数化、デフォルトは `~/Desktop/07新サイト資料/workout_data.json` |
| F1 | 完了サマリが件数のみ | 上位 3 件のサンプル表示追加 |
| F2 | 絵文字なし (既存は ✅ ✓ 📊 使用) | 既存パターンに揃えて絵文字追加 |

---

## 配置先

| 修正版ファイル | 配置先 |
|---|---|
| `/tmp/06_implementation_drafts_v2/20260601000001_workout_system.sql` | `06_kinniku_juku_app/supabase/migrations/` |
| `/tmp/06_implementation_drafts_v2/workout/types.ts` | `06_kinniku_juku_app/src/lib/workout/types.ts` |
| `/tmp/06_implementation_drafts_v2/workout/matching.ts` | `06_kinniku_juku_app/src/lib/workout/matching.ts` |
| `/tmp/06_implementation_drafts_v2/workout/queries.ts` | `06_kinniku_juku_app/src/lib/workout/queries.ts` |
| `/tmp/06_implementation_drafts_v2/workout/actions.ts` | `06_kinniku_juku_app/src/lib/workout/actions.ts` |
| `/tmp/06_implementation_drafts_v2/seed_workout_templates.js` | `06_kinniku_juku_app/scripts/seed_workout_templates.js` |

---

## 既存作業への影響

**ゼロ**。

- 修正は「**まだ Supabase に入れていない新規 SQL**」の中身のみ
- 既存テーブル (`monthly_audits` / `goal_sheets` / `tool_calculations` / `users` / `admin_users` 等) には触れていない
- 既存データも全部そのまま、Phase 3 / Day 1〜10 の成果物 (月次添削 / 目標シート / ツール 4 種) は無傷

そのまま前チャット草案を流していたら「`users.role` 列がないエラーで止まる」or「管理者が誰もアクセスできない壊れた機能ができる」状態でした。配置前に発見したので無傷で済みました。

---

## 次のステップ

1. **きよむさん**: Supabase ダッシュボード SQL Editor で `20260601000001_workout_system.sql` を Run
2. **きよむさん**: `cd 06_kinniku_juku_app && node --env-file=.env.local scripts/seed_workout_templates.js` 実行
3. **Claude**: シード後の動作確認 (193 件入ったかの SELECT クエリ)
4. **Claude**: カルテ入力 UI / ハブ画面 UI / マッチング検索 UI / リクエスト UI を順次実装
5. **きよむさん (並行)**: 残りカルテ補完 (性別 27 + 年齢層 79) → 完了後 277 件全部使える状態に

---

## 残課題 (memory 更新)

- `project_kinniku_juku_workout_menu.md` の重点部位「お尻」表記が古い → 「肩」に更新する (引き継ぎ書が新しい合意)

---

## 関連ファイル

- 引き継ぎ書: `_handoff_to_workout_review_2026-06-01.md`
- 合意の正典: `_consolidated_agreements_2026-05-25.md`
- 関連 memory: `project_kinniku_juku_workout_menu.md` / `project_kinniku_juku_workout_data_progress.md` / `project_kinniku_juku_workout_implementation_draft.md` / `project_kinniku_juku_admin_user_hub.md`
