import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * テスト ローンチ太郎 のパスワードを reset (= 動作確認用、 使ったら削除)
 *
 * 使い方:
 *   read -s NEW_PW
 *   NEW_PW="$NEW_PW" node scripts/_tmp_reset_pw.mjs
 */

const USER_ID = "25364047-0425-48d1-93f0-38bdc41d9402";

const envText = readFileSync("/tmp/.env.prod", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.PROD_SUPABASE_URL;
const SERVICE_ROLE = env.PROD_SERVICE_ROLE_KEY;
const NEW_PW = process.env.NEW_PW;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ /tmp/.env.prod から URL/KEY が読めません");
  process.exit(1);
}
if (!NEW_PW) {
  console.error("❌ NEW_PW 環境変数を指定してください");
  process.exit(1);
}
if (NEW_PW.length < 8) {
  console.error("❌ NEW_PW は 8 文字以上にしてください");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.updateUserById(USER_ID, {
  password: NEW_PW,
});

if (error) {
  console.error("❌ FAILED:", error.message);
  process.exit(1);
}

console.log("✅ Password reset OK for:", data.user.email);
console.log("   user_id:", data.user.id);
console.log("");
console.log("→ https://juku.norifitness.com/login で新 PW でログインできます");
