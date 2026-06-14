/**
 * E2E テスト受講生のデータを「入会直後」 状態にリセットする。
 *
 * ★ ハードガード (= 構造的事故防止) ★
 *   1. メアドが E2E_STUDENT_EMAIL と一致する auth ユーザーを SELECT
 *   2. 該当ゼロ → abort
 *   3. 該当 id が admin_users にも存在 (= 管理者と被ってる) → abort
 *   4. WHERE 句は **すべて user_id = <e2e_id> に限定**
 *   5. WHERE 無し全件削除は構文レベルで存在しない実装
 *
 * リセット対象 (= 該当 user_id 限定):
 *   - user_workout_carte               全 delete
 *   - workout_requests / carte_update_requests など 要望系 全 delete
 *   - user_workout_menus + 関連子テーブル 全 delete
 *   - body_metrics                     全 delete
 *   - goal_sheets                      全 delete
 *   - monthly_audits                   全 delete
 *   - shipments                        全 delete
 *   - lesson_reviews                   全 delete
 *   - user_profiles.birthday           null に戻す (= 行は維持)
 *
 * 維持:
 *   - auth.users 行
 *   - public.users 行
 *   - user_profiles 行 (birthday null + その他は null)
 *
 * 実行:
 *   node e2e/setup/reset_e2e_student.js
 *   npm run reset:e2e
 *   (Playwright beforeEach から自動実行)
 *
 * 関連:
 *   - seed_e2e_student.js (初回作成)
 *   - feedback-delegation-rules-2026-06-14 (破壊スクリプト承認時ゲート)
 *   - feedback-data-lifecycle-5questions Q3 (権限) のハードガード適用例
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// =====================================================================
// .env.local 読み込み
// =====================================================================
const envPath = path.resolve(__dirname, "../../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^=]+?)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const E2E_EMAIL = process.env.E2E_STUDENT_EMAIL || "e2e-student@test.local";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// =====================================================================
// 削除対象テーブル (user_id 列で識別される受講生スコープのもの)
// 新規テーブル追加時はここに追加することで一元管理
// =====================================================================
// 注: テーブル名は 20260601000001_workout_system.sql で確認済の正規名
//   user_workout_menu (単数) / user_workout_request (単数) / user_carte_request (単数)
const TABLES_USER_ID_SCOPED = [
  "user_workout_menu",
  "user_workout_request",
  "user_carte_request",
  "user_workout_carte",
  "body_metrics",
  "goal_sheets",
  "monthly_audits",
  "shipments",
  "lesson_reviews",
];

async function main() {
  console.log(`[reset_e2e_student] target email = ${E2E_EMAIL}`);

  // =====================================================================
  // ★ ハードガード ★
  // =====================================================================
  // 1. メアド経由で auth user id を引く
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    console.error(`[ABORT] listUsers failed: ${listError.message}`);
    process.exit(1);
  }
  const authUser = users.find((u) => u.email === E2E_EMAIL);

  // 2. 該当なし → abort (= 全件削除事故 防止の核)
  if (!authUser) {
    console.error(
      `[ABORT] E2E 受講生 (${E2E_EMAIL}) が auth.users に存在しません。`
    );
    console.error(`先に seed_e2e_student.js を実行してください。`);
    process.exit(1);
  }
  const e2eUserId = authUser.id;
  console.log(`[reset_e2e_student] resolved e2e_user_id = ${e2eUserId}`);

  // 3. 管理者と被ってないか確認 (= 万一の取り違え防止)
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", e2eUserId)
    .maybeSingle();
  if (adminRow) {
    console.error(
      `[ABORT] 該当 user_id (${e2eUserId}) が admin_users にも存在します。`
    );
    console.error("E2E 受講生と管理者が同一アカウント = 設計違反、 リセット中断。");
    process.exit(1);
  }

  // 4. 該当 id が public.users に存在するか確認
  const { data: publicUser } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", e2eUserId)
    .maybeSingle();
  if (!publicUser) {
    console.error(`[ABORT] public.users に該当行なし、 seed が壊れています。`);
    process.exit(1);
  }
  if (publicUser.email !== E2E_EMAIL) {
    console.error(
      `[ABORT] public.users.email (${publicUser.email}) と E2E_EMAIL (${E2E_EMAIL}) が不一致。 取り違え防止のため中断。`
    );
    process.exit(1);
  }

  console.log(`[reset_e2e_student] ハードガード通過 ✓`);

  // =====================================================================
  // 削除実行 (= すべて user_id = e2eUserId で限定)
  // =====================================================================
  for (const table of TABLES_USER_ID_SCOPED) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", e2eUserId);
    if (error) {
      // 一部テーブルは未作成の可能性あり (例: carte_update_requests がリネームされた場合)
      // 致命的ではないので warn で続行
      console.warn(`[WARN] ${table} delete: ${error.message}`);
    } else {
      console.log(`[reset_e2e_student] ${table}: ${count ?? 0} 行 削除`);
    }
  }

  // =====================================================================
  // user_profiles.birthday を null に戻す (= 行は維持)
  // =====================================================================
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ birthday: null })
    .eq("user_id", e2eUserId);
  if (profileError) {
    console.error(`[ERROR] user_profiles.birthday reset: ${profileError.message}`);
    process.exit(1);
  }
  console.log(`[reset_e2e_student] user_profiles.birthday を null にリセット`);

  console.log("[reset_e2e_student] ✅ done");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
