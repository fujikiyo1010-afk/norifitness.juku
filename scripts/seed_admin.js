/**
 * 管理者を admin_users テーブルに UPSERT する開発用スクリプト。
 *
 * 役割:
 *   - 指定メアドの auth.users から id を引いて admin_users に UPSERT
 *   - 何度実行しても安全 (onConflict: "id" do update)
 *   - DELETE しないので、 admin_users.id を FK 参照している他テーブル
 *     (goal_sheets.reviewed_by 等) と衝突しない
 *
 * 必要な背景:
 *   admin_users.id は auth.users(id) を on delete cascade で参照しているため、
 *   テスト中に auth ユーザーをリセット (Dashboard で delete 等) すると
 *   admin_users 行も道連れで消える。 復旧手段として src 全体に admin_users
 *   への insert 経路が無く、 詰まる事故が起きていた (= 5 問セルフテスト
 *   Q1 = 生産者なしの穴)。 このスクリプトが生産者の役割を担う。
 *
 * 実行:
 *   node scripts/seed_admin.js <email> [name] [role]
 *
 * 例:
 *   node scripts/seed_admin.js fujikiyo1010@gmail.com きよむ superadmin
 *   node scripts/seed_admin.js secondary@example.com 補助管理者 admin
 *
 * デフォルト:
 *   name  = "管理者"
 *   role  = "superadmin"
 *
 * 関連:
 *   - スキーマ: supabase/migrations/20260519000001_initial_schema.sql (admin_users)
 *   - 認証: src/lib/auth/admin.ts (requireAdmin)
 *   - DO_NOT_DO.md: fujikiyo1010@gmail.com は管理者専用、 テスト掃除で消さない
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// =====================================================================
// .env.local 読み込み (既存 seed_test_student.js と同じ流儀)
// =====================================================================
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
  console.error(
    "[ERROR] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local"
  );
  process.exit(1);
}

// =====================================================================
// 引数パース
// =====================================================================
const [, , emailArg, nameArg, roleArg] = process.argv;

if (!emailArg) {
  console.error("[ERROR] email argument required");
  console.error("Usage: node scripts/seed_admin.js <email> [name] [role]");
  console.error(
    "Example: node scripts/seed_admin.js fujikiyo1010@gmail.com きよむ superadmin"
  );
  process.exit(1);
}

const email = emailArg.trim();
const name = (nameArg || "管理者").trim();
const role = (roleArg || "superadmin").trim();

if (role !== "superadmin" && role !== "admin") {
  console.error(
    `[ERROR] role must be "superadmin" or "admin" (got "${role}")`
  );
  process.exit(1);
}

// =====================================================================
// 本処理
// =====================================================================
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`[seed_admin] target email = ${email}`);
  console.log(`[seed_admin] name = ${name}, role = ${role}`);

  // 1. auth.users から id を引く (admin API)
  //    listUsers で email 一致を探す。 件数多いプロジェクトでは page 分けが要るが、
  //    ローカル/小規模では perPage=200 で十分。
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 200 });

  if (listError) {
    console.error(`[ERROR] failed to list auth users: ${listError.message}`);
    process.exit(1);
  }

  const authUser = users.find((u) => u.email === email);

  if (!authUser) {
    console.error(`[ERROR] auth.users に email=${email} が見つかりません`);
    console.error(
      "対象アカウントを先に Supabase Auth で作成してから再実行してください"
    );
    process.exit(1);
  }

  console.log(`[seed_admin] auth.users.id = ${authUser.id}`);

  // 2. admin_users に UPSERT
  //    onConflict: "id" do update で、 行が既にあれば email/name/role/is_active を上書き
  //    DELETE しないので FK 参照 (goal_sheets.reviewed_by 等) と衝突しない
  const { error: upsertError } = await supabase
    .from("admin_users")
    .upsert(
      {
        id: authUser.id,
        email,
        name,
        role,
        is_active: true,
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error(`[ERROR] admin_users UPSERT failed: ${upsertError.message}`);
    process.exit(1);
  }

  // 3. 結果確認
  const { data: result, error: selectError } = await supabase
    .from("admin_users")
    .select("id, email, name, role, is_active")
    .eq("id", authUser.id)
    .single();

  if (selectError || !result) {
    console.error(
      `[ERROR] UPSERT 後の確認 SELECT 失敗: ${selectError?.message ?? "no row"}`
    );
    process.exit(1);
  }

  console.log("[seed_admin] ✅ done");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
