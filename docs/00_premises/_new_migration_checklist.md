# 新規 Supabase マイグレーション作成前チェックリスト

**作成日**: 2026-06-01
**作成経緯**: 2026-06-01 筋トレメニュー機能の草案 SQL が既存スキーマの細部を見落として書かれていたため、配置直前まで気付かない事故が発生。再発防止のためのチェックリスト。
**用途**: 新規マイグレーション SQL や Server Action ファイルを作成する前に、必ず本ファイルの項目を確認する。

---

## ⚠️ 重要

引き継ぎ書 + memory には **「設計判断」** は完璧に書かれているが、**「既存スキーマの細部」** までは書かれていない。新規 SQL を書く前に、**既存マイグレーション SQL 本体を必ず Read する**。

---

## チェックリスト: SQL マイグレーション作成前

### 1. 既存マイグレーションを Read

```bash
ls -la 06_kinniku_juku_app/supabase/migrations/
```

最初のマイグレーション (`20260519000001_initial_schema.sql`) を必ず Read して以下を確認:

- ヘルパー関数の存在
- 共通 Trigger の存在
- 既存テーブル構造
- 既存カラム (特に `user_profiles` の列: birthday, avatar_url 等)

### 2. RLS は `public.is_admin()` を使う

❌ ダメな書き方:
```sql
exists (select 1 from public.users where id = auth.uid() and role = 'admin')
```

✅ 正しい書き方:
```sql
using (public.is_admin())
with check (public.is_admin())
```

理由: `public.users` に `role` 列はない。管理者は `public.admin_users` 別テーブル。既存ヘルパー関数 `public.is_admin()` / `public.is_superadmin()` を使う。

### 3. `updated_at` は共通 `public.set_updated_at()` Trigger を使う

❌ ダメ: 独自 Trigger で `new.updated_at := now()` を書く

✅ 正しい:
```sql
create trigger trg_xxx_updated_at
  before update on public.xxx
  for each row execute function public.set_updated_at();
```

各テーブルに必ず適用する (漏れがないか確認)。

### 4. 管理者 ID の参照は `public.admin_users(id)`

❌ ダメ: 「対応した管理者」を `public.users(id)` (受講生マスタ) で参照
✅ 正しい: `public.admin_users(id)` で参照

```sql
handled_by uuid references public.admin_users(id) on delete set null
```

### 5. 既存 `user_profiles` の列と重複しない

`user_profiles` には既に以下の列がある:
- `birthday` (date) — 生年月日
- `avatar_url` (text)
- `family_name`, `given_name` (text)
- `phone`, `address`, `twitter`, `facebook`, `instagram`, `line_account`, `bio` (text)

新テーブルでこれらと **同じ意味の列** を作らない。`user_profiles` を JOIN するか、`goal_sheets.content` 等の jsonb 内に持つ (合意の正典セクション 17 参照)。

### 6. `text[]` 比較は `IS DISTINCT FROM`

❌ ダメ: `new.array_col != old.array_col` (NULL の時に NULL を返す)
✅ 正しい: `new.array_col IS DISTINCT FROM old.array_col`

---

## チェックリスト: Server Action / Query ファイル作成前

### 1. 既存ライブラリ層のファイル構成を Read

```bash
ls -la 06_kinniku_juku_app/src/lib/monthly-audit/
ls -la 06_kinniku_juku_app/src/lib/goal-sheet/
ls -la 06_kinniku_juku_app/src/lib/tools/
```

既存 3 つは同じパターン:
- `types.ts` — 型定義 + 純粋関数
- `queries.ts` — Supabase 読み取り (Server Component から呼ぶ、`"use server"` 不要)
- `actions.ts` — Supabase 書き込み (Server Action、`"use server"` **必須**)

新機能も同じ構成にする。1 ファイルに全部詰め込まない。

### 2. ファイル冒頭の `"use server"` ディレクティブ

- `actions.ts`: `"use server"` を **1 行目に必ず書く**
- `queries.ts` / `types.ts` / `matching.ts`: 不要

### 3. 戻り値型は discriminated union

❌ ダメ: `throw new Error(...)`

✅ 正しい:
```ts
export type SaveXxxResult =
  | { ok: true; updated_at: string }
  | { ok: false; message: string };

if (error) return { ok: false, message: error.message };
return { ok: true, updated_at: data.updated_at };
```

UI 側の既存パターン (戻り値で error 判定) と整合する。

### 4. 認証チェック

- Server Action 内では `getAdminInfo()` (戻り値 null) で判定
- Server Component 内では `requireAdmin()` (redirect 動作) で判定
- `src/lib/auth/admin.ts` に既に実装済

### 5. `select` で列名明示

❌ ダメ: `select("*")`
✅ 正しい: `select("id, user_id, created_at, ...")` (列を明示列挙)

理由: 不要な列を取らない / 将来の機密列追加時に誤って取得しない / DB スキーマ変更時に型不整合がすぐ気付ける。

### 6. 型キャストは rowToRecord 関数経由

```ts
function rowToRecord(d: Record<string, unknown>): XxxRow {
  return {
    id: d.id as string,
    // ...
  };
}
```

`as XxxRow` で直接キャストしない (型安全性が落ちる)。

### 7. DB レコード型は `Row` サフィックス

既存パターン:
- `MonthlyAuditRow`, `GoalSheetRow`
- 新規も同様: `WorkoutTemplateRow`, `UserWorkoutCarteRow` 等

`interface` を使わず `type` で統一。

### 8. `revalidatePath` を忘れない

書き込み Server Action 後に必ず:
```ts
revalidatePath("/path/to/page", "page");
```

書き込み後にユーザーが画面遷移したら古い値が表示される事故を防ぐ。

---

## チェックリスト: シードスクリプト作成前

### 1. 既存スクリプトの拡張子と書き方

`scripts/` 配下は全て `.js` (CommonJS) + `require()` 形式。`.ts` を使わない (`tsx` 依存を増やさない)。

### 2. 環境変数は `--env-file` で読み込み

```bash
node --env-file=.env.local scripts/seed_xxx.js
```

スクリプト側は `process.env.NEXT_PUBLIC_SUPABASE_URL` 等をそのまま参照。dotenv ライブラリ不要。

### 3. 既存データを毀損しない削除

「シード由来のみ削除、受講生由来は保護」のパターン:

```js
.delete().is("source_user_id", null);  // シード由来のみ
```

### 4. ファイル名は snake_case

既存: `seed_phase2_2.js`, `dev_seed_monthly_audits.js`, `dev_reset_monthly_audits.js`

新規も統一: `seed_xxx.js` or `dev_seed_xxx.js`

---

## 関連ドキュメント

- 合意の正典: `_consolidated_agreements_2026-05-25.md`
- Phase 3 引き継ぎ書: `_handoff_to_phase3_2026-05-25.md`
- 直近の不整合事例: `_workout_sql_review_2026-06-01.md`

---

**このチェックリストは生きたドキュメント**。新たな不整合パターンを発見したら、ここに追記する。
