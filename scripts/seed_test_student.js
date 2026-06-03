/**
 * テスト用: 新規テスト受講生を Service Role で作成
 *
 *   - auth.users + public.users + user_profiles 3 テーブルに投入
 *   - メール: test-student-001@example.com
 *   - パスワード: TestStudent2026!
 *   - 名前: テスト太郎
 *   - 生年月日: 1995-04-15 (30代/男想定)
 *
 * 実行:
 *   node scripts/seed_test_student.js
 *
 * クリーンアップ:
 *   --clean フラグでテスト受講生を削除
 *   (auth.users から消すと FK カスケードで public.users / user_profiles も消える)
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// .env.local 読み込み
const envPath = path.resolve(__dirname, "../.env.local");
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ERROR] env keys missing");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const TEST_EMAIL = "test-student-001@example.com";
const TEST_PASSWORD = "TestStudent2026!";
const TEST_NAME = "テスト太郎";
const TEST_BIRTHDAY = "1995-04-15";

const clean = process.argv.includes("--clean");

async function main() {
  if (clean) {
    console.log("🧹 クリーンアップ: テスト受講生を削除");
    await cleanup();
    return;
  }
  console.log("🌱 テスト受講生 新規作成");

  // 1. 既存の test ユーザーがいないか確認
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();

  if (existing) {
    console.log(`  [i] 既に存在: ${existing.id}`);
    console.log("       --clean で削除してから再実行してください");
    console.log("");
    console.log(`📝 ログイン情報:`);
    console.log(`   email: ${TEST_EMAIL}`);
    console.log(`   password: ${TEST_PASSWORD}`);
    return;
  }

  // 2. auth.users に作成
  const { data: authData, error: authErr } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: TEST_NAME },
    });
  if (authErr) {
    console.error("  [×] auth.users 作成失敗:", authErr.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`  [✓] auth.users 作成 (id: ${userId})`);

  // 3. public.users に作成
  const { error: usersErr } = await supabase.from("users").insert({
    id: userId,
    email: TEST_EMAIL,
    name: TEST_NAME,
    joined_at: new Date().toISOString(),
    status: "active",
  });
  if (usersErr) {
    console.error("  [×] public.users 作成失敗:", usersErr.message);
    // ロールバック (auth.users 削除)
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log("  [✓] public.users 作成");

  // 4. user_profiles に birthday 投入
  const { error: profileErr } = await supabase.from("user_profiles").insert({
    user_id: userId,
    birthday: TEST_BIRTHDAY,
  });
  if (profileErr) {
    console.error("  [×] user_profiles 作成失敗:", profileErr.message);
    // ロールバックはせず、警告だけ
    console.error("       手動で投入が必要です");
  } else {
    console.log("  [✓] user_profiles 作成 (birthday: " + TEST_BIRTHDAY + ")");
  }

  console.log("");
  console.log("✅ 完了");
  console.log("");
  console.log("📝 ログイン情報:");
  console.log(`   email:    ${TEST_EMAIL}`);
  console.log(`   password: ${TEST_PASSWORD}`);
  console.log("");
  console.log("🔑 ログイン URL: http://localhost:3000/login");
  console.log(
    `🆔 user_id (管理側 URL 用): ${userId}`
  );
  console.log(
    `📍 管理側ハブ URL: http://localhost:3000/admin/users/${userId}`
  );
}

async function cleanup() {
  // email でユーザー検索
  const { data: u } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();
  if (!u) {
    console.log("  [i] テスト受講生が存在しません");
    return;
  }
  const userId = u.id;

  // auth.users 削除 → FK カスケードで public.users / user_profiles も消える
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("  [×] auth.users 削除失敗:", error.message);
    process.exit(1);
  }
  console.log(`  [✓] テスト受講生 (${userId}) を削除`);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
