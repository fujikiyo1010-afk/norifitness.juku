/**
 * E2E 専用テスト受講生を Supabase に冪等 UPSERT する。
 *
 * 役割:
 *   - auth.users にメアド = E2E_STUDENT_EMAIL のユーザーを作成 (既存なら skip)
 *   - public.users に対応行を upsert
 *   - public.user_profiles に空行を upsert (birthday は null のまま)
 *
 * 思想:
 *   - 通常受講生と完全分離 (= 別ドメイン @test.local)
 *   - 1 アカウント永続。 各テスト前のリセットは reset_e2e_student.js で行う
 *   - 何度実行しても安全 (= 冪等)
 *
 * 実行:
 *   node e2e/setup/seed_e2e_student.js
 *   npm run seed:e2e
 *
 * 環境変数:
 *   E2E_STUDENT_EMAIL    (デフォルト: e2e-student@test.local)
 *   E2E_STUDENT_PASSWORD (必須、 .env.local に記載)
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *
 * 関連:
 *   - reset_e2e_student.js (各テスト前のリセット、 ハードガード付き)
 *   - DO_NOT_DO.md R-2 (素アドレスをテスト受講生に使わない)
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// =====================================================================
// .env.local 読み込み (既存 seed_*.js と同じ流儀)
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
const E2E_PASSWORD = process.env.E2E_STUDENT_PASSWORD;
const E2E_NAME = "E2E テスト受講生";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}
if (!E2E_PASSWORD) {
  console.error("[ERROR] E2E_STUDENT_PASSWORD missing in .env.local");
  console.error('Add: E2E_STUDENT_PASSWORD="some-strong-password"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`[seed_e2e_student] target email = ${E2E_EMAIL}`);

  // 1. auth.users 確認
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    console.error(`[ERROR] listUsers failed: ${listError.message}`);
    process.exit(1);
  }

  let authUser = users.find((u) => u.email === E2E_EMAIL);

  // 2. なければ作成
  if (!authUser) {
    console.log(`[seed_e2e_student] auth user 不在 → 作成`);
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: E2E_EMAIL,
        password: E2E_PASSWORD,
        email_confirm: true,
        user_metadata: { name: E2E_NAME, e2e: true },
      });
    if (createError || !created?.user) {
      console.error(`[ERROR] createUser failed: ${createError?.message}`);
      process.exit(1);
    }
    authUser = created.user;
    console.log(`[seed_e2e_student] auth user 作成 ✓ id=${authUser.id}`);
  } else {
    console.log(`[seed_e2e_student] auth user 既存 ✓ id=${authUser.id}`);
    // パスワード再同期 (パスワード忘れ防止)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: E2E_PASSWORD }
    );
    if (updateError) {
      console.error(`[WARN] パスワード再設定失敗 (続行): ${updateError.message}`);
    }
  }

  // 3. public.users upsert
  const { error: usersError } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: E2E_EMAIL,
        name: E2E_NAME,
        status: "active",
      },
      { onConflict: "id" }
    );
  if (usersError) {
    console.error(`[ERROR] public.users upsert: ${usersError.message}`);
    process.exit(1);
  }

  // 4. user_profiles 空行 upsert
  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({ user_id: authUser.id }, { onConflict: "user_id" });
  if (profileError) {
    console.error(`[ERROR] user_profiles upsert: ${profileError.message}`);
    process.exit(1);
  }

  console.log("[seed_e2e_student] ✅ done");
  console.log(JSON.stringify({ id: authUser.id, email: E2E_EMAIL, name: E2E_NAME }, null, 2));
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
