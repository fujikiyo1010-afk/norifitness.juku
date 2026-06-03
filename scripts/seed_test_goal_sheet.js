/**
 * テスト用: 目標シートを「全項目入った状態」で投入
 *   - テストアカウント (きよむさん) の goal_sheets.content を上書き
 *   - 既存 audits があれば維持
 *   - 添削画面の右サイドパネル + 達成度バーの動作確認用
 *
 * 実行:
 *   node scripts/seed_test_goal_sheet.js
 *
 * クリーンアップ:
 *   既存の goal_sheets はそのまま残します (誤削除防止)
 *   削除したい場合は Supabase Dashboard で手動削除
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

const USER_ID = "f0c48fd1-bc43-4b64-8e01-b9d32b2aa172";

async function main() {
  console.log("🌱 目標シート テストデータ投入");

  // 既存 content を取得 (audits を維持するため)
  const { data: existing } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", USER_ID)
    .maybeSingle();

  const existingAudits = existing?.content?.audits ?? undefined;

  const newContent = {
    current_status: {
      weight_kg: 80,
      height_cm: 175,
      waist_cm: 85,
      neck_cm: 38,
      body_fat_pct: 22,
      maintenance_kcal: 2200,
      measured_at: "2026-06-01",
    },
    goal_selection: {
      target_weight_kg: 65,
      target_date: "2026-09-01",
      short_term:
        "3 ヶ月で 5kg 落として、シルエットを引き締める。",
      long_term:
        "1 年後に体脂肪率 15% 以下、見た目もパフォーマンスも整った体になる。",
      process:
        "毎日食事を記録 (MyFitnessPal) / 週 3 回筋トレ / 1 日 8000 歩以上歩く / 月 1 回体組成測定",
    },
    nutrition: {
      target_calorie: 2500,
      pfc: { p: 150, f: 60, c: 300 },
      carb_cycle: {
        weekly_pattern: ["low", "mid", "high", "low", "mid", "high", "low"],
      },
    },
    positive_goals: {
      achievement_feeling:
        "自信がついて、家族と海に行ったときに堂々と上半身を見せられる体になりたい。子供と思いっきり走り回って遊べる体力もつけたい。",
    },
    self_image: [
      {
        key: "item_1",
        label: "自分の体に対して批判的な思考を減らし、ありのままの自分を受け入れる",
        before: 4,
        after: 8,
      },
      { key: "item_2", label: "(未確定 2)", before: 5, after: 8 },
      { key: "item_3", label: "(未確定 3)", before: 3, after: 7 },
      { key: "item_4", label: "(未確定 4)", before: 6, after: 9 },
      { key: "item_5", label: "(未確定 5)", before: 4, after: 8 },
      { key: "item_6", label: "(未確定 6)", before: 5, after: 8 },
      { key: "item_7", label: "(未確定 7)", before: 3, after: 7 },
      { key: "item_8", label: "(未確定 8)", before: 4, after: 8 },
    ],
    audits: existingAudits, // 既存添削は維持
    filled_sections: [
      "current_status",
      "goal_selection",
      "nutrition",
      "positive_goals",
      "self_image",
    ],
  };

  const { error } = await supabase.from("goal_sheets").upsert(
    {
      user_id: USER_ID,
      content: newContent,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[×] upsert failed:", error.message);
    process.exit(1);
  }

  console.log("  [✓] 目標シート 全 5 セクション 投入完了");
  console.log("");
  console.log("✅ 完了。添削画面で確認:");
  console.log(`   http://localhost:3000/admin/users/${USER_ID}/goal-sheet`);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
