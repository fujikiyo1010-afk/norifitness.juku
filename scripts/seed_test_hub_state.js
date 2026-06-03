/**
 * テスト用: 受講生ハブ画面で「対応事項あり + BMI/体脂肪表示」状態を再現するための投入スクリプト
 *
 * 投入する状態:
 *   1. カルテ更新リクエスト 1 件 (受講生から)
 *   2. メニュー変更リクエスト 1 件 (受講生から)
 *   3. カルテ変更フラグ立てる (menu_review_needed = true)
 *   4. 目標シートに身長 + 体脂肪率を入れる (BMI 計算 + 体脂肪表示用)
 *
 * 実行:
 *   cd 06_kinniku_juku_app
 *   node scripts/seed_test_hub_state.js
 *
 * クリーンアップ (元に戻す):
 *   node scripts/seed_test_hub_state.js --clean
 *
 * 注意:
 *   - .env.local の SUPABASE_SERVICE_ROLE_KEY が必要
 *   - 対象ユーザー: f0c48fd1-bc43-4b64-8e01-b9d32b2aa172 (きよむさんテストアカウント)
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// .env.local 読み込み (シンプル実装)
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const USER_ID = "f0c48fd1-bc43-4b64-8e01-b9d32b2aa172";

const SEED_TAG = "[SEED_TEST_HUB]"; // クリーンアップ識別用

const clean = process.argv.includes("--clean");

async function main() {
  if (clean) {
    console.log("🧹 クリーンアップモード");
    await cleanup();
    return;
  }
  console.log("🌱 テストデータ投入開始");

  // 1. カルテ更新リクエスト
  const carteRes = await supabase.from("user_carte_request").insert({
    user_id: USER_ID,
    request_text: `${SEED_TAG} 最近背中も鍛えたいと思っています。背中の種目を増やしてもらえますか？あとお尻も気になっています。`,
    status: "pending",
  });
  if (carteRes.error) console.error("  [×] carte_request:", carteRes.error.message);
  else console.log("  [✓] カルテ更新リクエスト 1 件");

  // 2. メニュー変更リクエスト
  const workoutRes = await supabase.from("user_workout_request").insert({
    user_id: USER_ID,
    request_text: `${SEED_TAG} ベンチプレスがちょっとしんどいので、別の胸の種目に変えてもらえますか？`,
    status: "pending",
  });
  if (workoutRes.error)
    console.error("  [×] workout_request:", workoutRes.error.message);
  else console.log("  [✓] メニュー変更リクエスト 1 件");

  // 3. カルテ変更フラグ (menu_review_needed = true)
  const flagRes = await supabase
    .from("user_workout_carte")
    .update({ menu_review_needed: true })
    .eq("user_id", USER_ID);
  if (flagRes.error)
    console.error("  [×] menu_review_needed:", flagRes.error.message);
  else console.log("  [✓] カルテ変更フラグ ON");

  // 4. 目標シートに身長 + 体脂肪率を入れる
  //    既存があれば content をマージ、なければ新規作成
  const { data: existing } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", USER_ID)
    .maybeSingle();

  const existingContent = existing?.content ?? {};
  const newContent = {
    ...existingContent,
    current_status: {
      ...(existingContent.current_status ?? {}),
      height_cm: 175,
      body_fat_pct: 18.5,
      neck_cm: 38,
      measured_at: "2026-06-01",
    },
  };

  const sheetRes = await supabase.from("goal_sheets").upsert(
    {
      user_id: USER_ID,
      content: newContent,
    },
    { onConflict: "user_id" }
  );
  if (sheetRes.error)
    console.error("  [×] goal_sheets:", sheetRes.error.message);
  else
    console.log("  [✓] 目標シート: 身長 175cm / 体脂肪率 18.5% を投入");

  console.log("");
  console.log("✅ 完了。ハブ画面で確認してください:");
  console.log(
    `   http://localhost:3000/admin/users/${USER_ID}`
  );
}

async function cleanup() {
  // SEED_TAG を含むリクエストだけ削除
  const carteDel = await supabase
    .from("user_carte_request")
    .delete()
    .like("request_text", `${SEED_TAG}%`);
  if (carteDel.error) console.error("  [×] carte_request:", carteDel.error.message);
  else console.log("  [✓] テスト用カルテ更新リクエストを削除");

  const workoutDel = await supabase
    .from("user_workout_request")
    .delete()
    .like("request_text", `${SEED_TAG}%`);
  if (workoutDel.error)
    console.error("  [×] workout_request:", workoutDel.error.message);
  else console.log("  [✓] テスト用メニュー変更リクエストを削除");

  // カルテフラグを OFF に戻す
  const flagDel = await supabase
    .from("user_workout_carte")
    .update({ menu_review_needed: false })
    .eq("user_id", USER_ID);
  if (flagDel.error) console.error("  [×] menu_review_needed:", flagDel.error.message);
  else console.log("  [✓] カルテ変更フラグ OFF");

  // goal_sheets はテスト用に作成された場合のみ削除
  //   既存データがあるかもしれないので、ここでは削除しない。
  //   必要なら手動で行うこと。
  console.log("  [i] 目標シートはそのまま残します (誤削除防止)");
  console.log("");
  console.log("✅ クリーンアップ完了");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
