// Phase 3 開発用: monthly_audits テーブルを全件削除 (テスト中の再記入のため)
//
// 使い方:
//   cd 06_kinniku_juku_app
//   node --env-file=.env.local scripts/dev_reset_monthly_audits.js
//
// ⚠️ 本番環境では絶対に実行しない (DELETE 対象は全行)

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("✗ env vars not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  console.error("  Usage: node --env-file=.env.local scripts/dev_reset_monthly_audits.js");
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  // 削除前の件数
  const { count: beforeCount, error: countErr } = await supabase
    .from("monthly_audits")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    console.error("✗ Count failed:", countErr.message);
    process.exit(1);
  }
  console.log(`📊 削除前: ${beforeCount ?? 0} 件`);

  if ((beforeCount ?? 0) === 0) {
    console.log("✓ 既に空です、何もしません");
    process.exit(0);
  }

  // 全件削除 (id IS NOT NULL = 全行が対象)
  const { error: delErr } = await supabase
    .from("monthly_audits")
    .delete()
    .not("id", "is", null);
  if (delErr) {
    console.error("✗ Delete failed:", delErr.message);
    process.exit(1);
  }

  // 削除後の件数
  const { count: afterCount } = await supabase
    .from("monthly_audits")
    .select("id", { count: "exact", head: true });

  console.log(`✓ 削除完了: ${beforeCount - (afterCount ?? 0)} 件削除 (${afterCount ?? 0} 件残り)`);
})();
