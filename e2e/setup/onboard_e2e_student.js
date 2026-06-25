/**
 * E2E 受講生を「オンボーディング完了」状態にする (= shipments 行を upsert)。
 *
 * 背景:
 *   - src/app/page.tsx のホームガードは shipments 行が無いと /onboarding へ強制リダイレクト。
 *   - reset_e2e_student.js は「入会直後」に戻すため shipments を全 delete する。
 *   - よって「ホーム(/)を検証するテスト」は reset 後にこのスクリプトでオンボ済みに戻す必要がある。
 *
 * 思想:
 *   - 製品は一切変更しない。テスト前提を実運用(オンボ済み受講生)に合わせるだけ。
 *   - 冪等 (shipments は unique(user_id) のため upsert)。
 *
 * 実行: node e2e/setup/onboard_e2e_student.js
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
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
  console.error("[ERROR] SUPABASE env missing");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    console.error(`[ERROR] listUsers: ${listError.message}`);
    process.exit(1);
  }
  const authUser = users.find((u) => u.email === E2E_EMAIL);
  if (!authUser) {
    console.error(`[ERROR] E2E student not found (${E2E_EMAIL}). seed first.`);
    process.exit(1);
  }

  // shipments upsert = オンボ完了マーカー
  const { error } = await supabase.from("shipments").upsert(
    {
      user_id: authUser.id,
      postal_code: "0000000",
      address_line: "E2Eテスト住所",
      recipient_name: "E2E テスト受講生",
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error(`[ERROR] shipments upsert: ${error.message}`);
    process.exit(1);
  }
  console.log(`[onboard_e2e_student] ✅ shipments upsert 済 (onboarded) id=${authUser.id}`);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
