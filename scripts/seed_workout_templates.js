// 筋トレメニューテンプレ シードスクリプト
// workout_data.json (193件、後日 277件) → workout_templates テーブル
//
// 使い方:
//   cd 06_kinniku_juku_app
//   node --env-file=.env.local scripts/seed_workout_templates.js
//
// オプション:
//   WORKOUT_JSON=/path/to/file.json で JSON パス指定可能
//   デフォルト: ~/Desktop/07新サイト資料/workout_data.json
//
// 安全設計:
//   - source_user_id IS NULL の行のみ削除 (シード由来のみ)
//   - 既存受講生からの新規メニュー (source_user_id IS NOT NULL) は保護
//   - 50 件バッチ INSERT で失敗局所化

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jsonPath =
  process.env.WORKOUT_JSON ||
  path.join(os.homedir(), "Desktop", "07新サイト資料", "workout_data.json");

if (!url || !key) {
  console.error("✗ env vars not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  console.error("  Usage: node --env-file=.env.local scripts/seed_workout_templates.js");
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`✗ ファイルが見つかりません: ${jsonPath}`);
  console.error("  WORKOUT_JSON=/path/to/file.json で指定するか、デフォルトパスに配置してください");
  process.exit(1);
}

const supabase = createClient(url, key);
const BATCH_SIZE = 50;

/* workout_data.json 構造例:
   [
     {
       "ファイル名": "水野剛さん専用ダンベル毎日コツコツメニュー.xlsx",
       "受講生メタ": {
         "名前": "水野剛",
         "性別": "男",
         "年齢層": "30代",
         "器具": "ダンベルのみ",
         "頻度": "毎日コツコツ",
         "カルテ照合": "○"
       },
       "進化サイクル": [...],
       "集計": {
         "サイクル数": 3,
         "総種目数": 27,
         "部位カバー": { "脚": 10, "胸": 5 },
         "重点部位": "脚"
       }
     }
   ]
*/

(async () => {
  console.log(`📂 読み込み: ${jsonPath}`);
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`   ${raw.length} 件`);

  // 削除前カウント (シード由来のみ)
  const { count: beforeCount } = await supabase
    .from("workout_templates")
    .select("id", { count: "exact", head: true })
    .is("source_user_id", null);
  console.log(`📊 既存シード由来: ${beforeCount ?? 0} 件`);

  // 既存シードクリア (source_user_id IS NULL のみ、受講生由来は保護)
  if ((beforeCount ?? 0) > 0) {
    const { error: delErr } = await supabase
      .from("workout_templates")
      .delete()
      .is("source_user_id", null);
    if (delErr) {
      console.error(`✗ 既存クリア失敗: ${delErr.message}`);
      process.exit(1);
    }
    console.log(`✓ 既存シード ${beforeCount} 件 削除完了`);
  }

  // 既存受講生由来の件数表示 (保護対象)
  const { count: protectedCount } = await supabase
    .from("workout_templates")
    .select("id", { count: "exact", head: true })
    .not("source_user_id", "is", null);
  if ((protectedCount ?? 0) > 0) {
    console.log(`🛡  受講生由来 ${protectedCount} 件は保護 (削除しない)`);
  }

  // バッチ INSERT
  let success = 0;
  let failed = 0;

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE).map((item) => ({
      source_name: item.受講生メタ.名前 ?? null,
      source_filename: item.ファイル名 ?? null,
      source_user_id: null,                       // シード時は紐付けなし
      gender: item.受講生メタ.性別,
      age_band: item.受講生メタ.年齢層,
      instrument: item.受講生メタ.器具 ?? null,
      frequency: item.受講生メタ.頻度 ?? null,
      primary_body: item.集計.重点部位 ?? null,
      cycles: item.進化サイクル ?? [],
      body_parts_main: item.集計.部位カバー ?? {},
      total_exercises: item.集計.総種目数 ?? 0,
      cycle_count: item.集計.サイクル数 ?? 0,
      karte_match: item.受講生メタ.カルテ照合 ?? null,
      is_active: true,
    }));

    const { error } = await supabase.from("workout_templates").insert(batch);
    if (error) {
      console.error(`✗ バッチ ${Math.floor(i / BATCH_SIZE) + 1} 失敗: ${error.message}`);
      failed += batch.length;
    } else {
      success += batch.length;
      console.log(
        `  ✅ バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} 件 (累計 ${success}/${raw.length})`
      );
    }
  }

  console.log("\n📊 === 完了サマリ ===");
  console.log(`   成功: ${success} 件`);
  console.log(`   失敗: ${failed} 件`);
  console.log(`   全件: ${raw.length} 件`);

  // 上位 3 件の例を表示 (動作確認用)
  if (success > 0) {
    const { data: samples } = await supabase
      .from("workout_templates")
      .select("id, source_name, gender, age_band, primary_body, total_exercises")
      .is("source_user_id", null)
      .order("created_at", { ascending: false })
      .limit(3);
    if (samples && samples.length > 0) {
      console.log("\n📋 シードされた上位 3 件:");
      for (const s of samples) {
        console.log(
          `   ${s.source_name} (${s.gender}/${s.age_band}/${s.primary_body ?? "-"})  種目数 ${s.total_exercises}`
        );
      }
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
})().catch((err) => {
  console.error("✗ 予期しないエラー:", err);
  process.exit(1);
});
