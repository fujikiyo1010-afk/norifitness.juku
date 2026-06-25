/**
 * prod デモ受講生: 4 ヶ月目 + アラート 4 個発火 状態を再現
 *
 * 目的:
 *   きよむさんが iPhone でログインして 3 人に画面を見せるための
 *   「リアルなデモ受講生」 アカウントを作る。
 *
 * 仕様:
 *   - 氏名: 【デモ】乖離 太郎
 *   - email: demo-4month@norifitness.com
 *   - password: nori4645
 *   - 入塾日: 2026-02-22 (= today 2026-06-22 から 4 ヶ月前)
 *
 * 発火する 4 アラート:
 *   1. monthly_overdue (= 5 月分 未提出 / 期限 5/31 超過)
 *   2. body_metrics_stalled (= 最終記録 6/12 / 10 日途絶)
 *   3. goal_deviation (= 目標 70kg vs 直近 79kg / 12.86 %)
 *   4. その他 (user_carte_request pending = アラート表示物の 1 つ)
 *
 * 環境変数: /tmp/.env.prod から読む
 *
 * 実行:
 *   node scripts/seed_demo_4month.mjs
 *
 * クリーンアップ:
 *   node scripts/seed_demo_4month.mjs --clean
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// ===== 0. /tmp/.env.prod 読み込み =====
const ENV_PATH = "/tmp/.env.prod";
if (!fs.existsSync(ENV_PATH)) {
  console.error(`[FATAL] env file not found: ${ENV_PATH}`);
  process.exit(1);
}
const envText = fs.readFileSync(ENV_PATH, "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^=#]+?)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[FATAL] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in /tmp/.env.prod");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ===== 1. 定数 =====
const DEMO_EMAIL = "demo-4month@norifitness.com";
const DEMO_PASSWORD = "nori4645";
const DEMO_NAME = "【デモ】乖離 太郎";
const DEMO_BIRTHDAY = "1984-01-15"; // 42 歳
const DEMO_GENDER = "男";
const DEMO_HEIGHT_CM = 172;
const DEMO_PHONE = "090-0000-0000";
const DEMO_POSTAL_CODE = "150-0031";
const DEMO_ADDRESS = "東京都渋谷区桜丘町31-2";
const DEMO_PREFECTURE = "東京都";
const DEMO_CITY = "渋谷区";
const DEMO_ADDRESS_LINE = "桜丘町31-2";
const JOINED_AT = "2026-02-22T10:00:00+09:00";

// 体組成 推移基準点
const BODY_START = { date: "2026-02-22", weight: 80.0, fat: 28.0 };
const BODY_MID1 = { date: "2026-04-22", weight: 75.0, fat: 24.0 };
const BODY_MID2 = { date: "2026-05-22", weight: 77.0, fat: 25.5 };
const BODY_LAST = { date: "2026-06-12", weight: 79.0, fat: 27.0 };

const clean = process.argv.includes("--clean");

// ===== ユーティリティ =====

function daysBetween(d1, d2) {
  const ms = new Date(d2).getTime() - new Date(d1).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 線形補完 + ノイズ
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// 4 区間 (start→mid1→mid2→last) を線形補完で繋ぐ
function interpolateMetrics(date) {
  const t1 = daysBetween(BODY_START.date, BODY_MID1.date);
  const t2 = daysBetween(BODY_MID1.date, BODY_MID2.date);
  const t3 = daysBetween(BODY_MID2.date, BODY_LAST.date);
  const d = daysBetween(BODY_START.date, date);

  let weight, fat;
  if (d <= t1) {
    const ratio = d / t1;
    weight = lerp(BODY_START.weight, BODY_MID1.weight, ratio);
    fat = lerp(BODY_START.fat, BODY_MID1.fat, ratio);
  } else if (d <= t1 + t2) {
    const ratio = (d - t1) / t2;
    weight = lerp(BODY_MID1.weight, BODY_MID2.weight, ratio);
    fat = lerp(BODY_MID1.fat, BODY_MID2.fat, ratio);
  } else {
    const ratio = (d - t1 - t2) / t3;
    weight = lerp(BODY_MID2.weight, BODY_LAST.weight, ratio);
    fat = lerp(BODY_MID2.fat, BODY_LAST.fat, ratio);
  }
  // ノイズ ±0.2kg / ±0.3%
  weight += rand(-0.2, 0.2);
  fat += rand(-0.3, 0.3);
  return {
    weight_kg: Math.round(weight * 10) / 10,
    body_fat_percent: Math.round(fat * 10) / 10,
  };
}

// ===== クリーンアップ =====
async function cleanup() {
  console.log("🧹 クリーンアップモード");
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  if (!existing) {
    console.log("  [i] デモアカウントが存在しません");
    return;
  }
  // FK CASCADE で全関連データが削除される
  const { error } = await supabase.auth.admin.deleteUser(existing.id);
  if (error) {
    console.error("  [×] auth.users 削除失敗:", error.message);
    process.exit(1);
  }
  console.log(`  [✓] デモアカウント (${existing.id}) を削除 (CASCADE)`);
}

// ===== メイン =====
async function main() {
  if (clean) {
    await cleanup();
    return;
  }
  console.log("🌱 prod デモ受講生 作成開始");
  console.log(`   email: ${DEMO_EMAIL}`);
  console.log(`   name : ${DEMO_NAME}`);
  console.log("");

  // ----- 0. 既存があれば削除 (冪等性) -----
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  if (existing) {
    console.log("  [i] 既存デモアカウント発見 → 削除して再作成");
    const { error: delErr } = await supabase.auth.admin.deleteUser(existing.id);
    if (delErr) {
      console.error("  [×] 既存削除失敗:", delErr.message);
      process.exit(1);
    }
    console.log("  [✓] 既存削除完了");
  }

  // ----- 1. auth.users 作成 -----
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: DEMO_NAME },
  });
  if (authErr) {
    console.error("  [×] auth.users 作成失敗:", authErr.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`  [✓] auth.users 作成 (id: ${userId})`);

  // ----- 2. public.users 作成 -----
  const { error: usersErr } = await supabase.from("users").insert({
    id: userId,
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    joined_at: JOINED_AT,
    status: "active",
    email_notification_enabled: true,
  });
  if (usersErr) {
    console.error("  [×] public.users 作成失敗:", usersErr.message);
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log("  [✓] public.users 作成");

  // ----- 3. user_profiles 作成 -----
  // 注: user_profiles に sex / height_cm / postal_code カラムは無い
  //     性別 → user_workout_carte.gender、身長 → goal_sheets.content.current_status.height_cm、
  //     郵便番号 → shipments.postal_code に分散保存 (現スキーマに準拠)
  const { error: profileErr } = await supabase.from("user_profiles").insert({
    user_id: userId,
    birthday: DEMO_BIRTHDAY,
    phone: DEMO_PHONE,
    address: `〒${DEMO_POSTAL_CODE} ${DEMO_ADDRESS}`,
  });
  if (profileErr) {
    console.error("  [×] user_profiles 作成失敗:", profileErr.message);
    process.exit(1);
  }
  console.log("  [✓] user_profiles 作成 (birthday/phone/address)");

  // ----- 4. user_workout_carte 作成 -----
  const { error: carteErr } = await supabase.from("user_workout_carte").insert({
    user_id: userId,
    gender: DEMO_GENDER,
    environments: ["ジム"],
    frequency_wish: "週3",
    focus_body_parts: ["腹筋", "胸", "背中"],
    purposes: ["ダイエット", "見た目改善"],
    experience: "週次",
    medical_limits: [],
    ideal_body: "細マッチョ",
    menu_review_needed: false,
  });
  if (carteErr) {
    console.error("  [×] user_workout_carte 作成失敗:", carteErr.message);
    process.exit(1);
  }
  console.log("  [✓] user_workout_carte 作成 (= alerts.ts isDietGoal=true)");

  // ----- 5. user_workout_menu 作成 (1 件配布済) -----
  const sampleCycles = [
    {
      段階: "小",
      シート名: "デモ メニュー (4 ヶ月目)",
      週: [
        {
          日: "1日目",
          種目: [
            { 順番: "1", 種目名: "ベンチプレス", 回数: "10×3", インターバル: "90秒", 主部位: ["胸"], 補部位: ["三頭"] },
            { 順番: "2", 種目名: "ラットプルダウン", 回数: "10×3", インターバル: "90秒", 主部位: ["背中"], 補部位: ["二頭"] },
            { 順番: "3", 種目名: "クランチ", 回数: "15×3", インターバル: "60秒", 主部位: ["腹"], 補部位: [] },
          ],
        },
      ],
    },
  ];
  const { error: menuErr } = await supabase.from("user_workout_menu").insert({
    user_id: userId,
    template_id: null,
    template_snapshot: null,
    cycles: sampleCycles,
    notes: "デモ用 配布メニュー",
    effective_from: "2026-02-25",
    is_current: true,
  });
  if (menuErr) {
    console.error("  [×] user_workout_menu 作成失敗:", menuErr.message);
    process.exit(1);
  }
  console.log("  [✓] user_workout_menu 1 件配布 (is_current=true)");

  // ----- 6. goal_sheets 作成 -----
  // alerts.ts の goal_deviation 判定に target_weight_kg=70 が必須
  const goalSheetContent = {
    current_status: {
      weight_kg: 80,
      height_cm: DEMO_HEIGHT_CM,
      waist_cm: 92,
      neck_cm: 40,
      body_fat_pct: 28,
      maintenance_kcal: 2400,
      measured_at: "2026-02-22",
    },
    goal_selection: {
      target_weight_kg: 70, // ← 目標乖離アラート判定の起点
      target_date: "2026-08-22",
      short_term: "半年で 10kg 減量、 標準体重まで戻す。",
      long_term: "1 年後に体脂肪率 20% 以下、 健康診断オール A を維持。",
      process: "毎日カロミルで食事記録 / 週 3 回筋トレ / 1 日 8000 歩 / 月 1 回体組成測定",
    },
    nutrition: {
      target_calorie: 2000,
      pfc: { p: 140, f: 55, c: 230 },
      carb_cycle: {
        weekly_pattern: ["low", "mid", "high", "low", "mid", "high", "low"],
      },
    },
    positive_goals: {
      achievement_feeling:
        "自信がついて、 家族で温泉に行ったとき脱衣所でも引け目を感じない体になりたい。 仕事のパフォーマンスも上がるはず。",
    },
    self_image: [
      { key: "item_1", label: "自分の体に対して批判的な思考を減らし、ありのままの自分を受け入れることを学ぶ", before: 3, after: 8 },
      { key: "item_2", label: "メディアで描かれる体のイメージが現実とは異なることを理解しその影響を減らす", before: 4, after: 7 },
      { key: "item_3", label: "自分の体重やウエストを記録して客観的な数値の感覚を身につける", before: 5, after: 9 },
      { key: "item_4", label: "自分の肉体はどうやって動くのか?どのような体型なのか?に関する意識を高める", before: 3, after: 8 },
      { key: "item_5", label: "ボディイメージからくるストレスをやわらげる", before: 4, after: 8 },
      { key: "item_6", label: "そもそもボディイメージとは何かを学ぶ", before: 2, after: 7 },
      { key: "item_7", label: "自分が感じたネガティブなイメージを日記に書く", before: 2, after: 6 },
      { key: "item_8", label: "ネガティブな感情をプラスの感情にする", before: 3, after: 8 },
    ],
    filled_sections: [
      "current_status",
      "goal_selection",
      "nutrition",
      "positive_goals",
      "self_image",
    ],
  };
  const { error: sheetErr } = await supabase.from("goal_sheets").insert({
    user_id: userId,
    content: goalSheetContent,
  });
  if (sheetErr) {
    console.error("  [×] goal_sheets 作成失敗:", sheetErr.message);
    process.exit(1);
  }
  console.log("  [✓] goal_sheets 作成 (target_weight_kg=70)");

  // ----- 7. body_metrics 110 件投入 (2026-02-22 〜 2026-06-12) -----
  const bodyRows = [];
  const totalDays = daysBetween(BODY_START.date, BODY_LAST.date); // 110
  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(BODY_START.date, i);
    const m = interpolateMetrics(date);
    bodyRows.push({
      user_id: userId,
      recorded_at: date,
      weight_kg: m.weight_kg,
      body_fat_percent: m.body_fat_percent,
      waist_cm: null,
      note: null,
    });
  }
  // 分割 INSERT (一括 100 件超でも Supabase は OK だが安全に分割)
  const chunkSize = 50;
  let inserted = 0;
  for (let i = 0; i < bodyRows.length; i += chunkSize) {
    const chunk = bodyRows.slice(i, i + chunkSize);
    const { error } = await supabase.from("body_metrics").insert(chunk);
    if (error) {
      console.error("  [×] body_metrics 投入失敗:", error.message);
      process.exit(1);
    }
    inserted += chunk.length;
  }
  console.log(`  [✓] body_metrics ${inserted} 件投入 (2026-02-22 〜 2026-06-12)`);

  // ----- 8. monthly_audits 4 件投入 -----
  // 2026-02 / 03 / 04 = 完了、 2026-05 = 未提出 (= アラート発火)
  const completedItems = {
    q1: { score: 7, text: "食事はだいたい守れている。 たまに飲み会で乱れる。" },
    q2: { score: 6, text: "週 3 で筋トレできた。 仕事繁忙期は週 2 になることも。" },
    q3: { score: 8, text: "睡眠は 6-7 時間確保。 寝る前のスマホを減らした。" },
  };

  const audits = [
    {
      target_month: "2026-02-01",
      items: completedItems,
      items_filled_count: 17,
      last_saved_at: "2026-02-28T20:00:00+09:00",
      submitted_at: "2026-02-28T20:30:00+09:00",
      nori_video_vimeo_url: "https://vimeo.com/demo/feedback-2026-02",
      nori_video_vimeo_id: "demo20260201",
      nori_video_published_at: "2026-03-03T18:00:00+09:00",
      nori_video_duration_sec: 240,
    },
    {
      target_month: "2026-03-01",
      items: completedItems,
      items_filled_count: 17,
      last_saved_at: "2026-03-30T20:00:00+09:00",
      submitted_at: "2026-03-30T20:30:00+09:00",
      nori_video_vimeo_url: "https://vimeo.com/demo/feedback-2026-03",
      nori_video_vimeo_id: "demo20260301",
      nori_video_published_at: "2026-04-02T18:00:00+09:00",
      nori_video_duration_sec: 280,
    },
    {
      target_month: "2026-04-01",
      items: completedItems,
      items_filled_count: 17,
      last_saved_at: "2026-04-29T20:00:00+09:00",
      submitted_at: "2026-04-29T20:30:00+09:00",
      nori_video_vimeo_url: "https://vimeo.com/demo/feedback-2026-04",
      nori_video_vimeo_id: "demo20260401",
      nori_video_published_at: "2026-05-02T18:00:00+09:00",
      nori_video_duration_sec: 260,
    },
    {
      target_month: "2026-05-01",
      // 未提出 → アラート (monthly_overdue)
      items: {},
      items_filled_count: 0,
      last_saved_at: null,
      submitted_at: null,
      nori_video_vimeo_url: null,
      nori_video_vimeo_id: null,
      nori_video_published_at: null,
      nori_video_duration_sec: null,
    },
  ];
  for (const a of audits) {
    const { error } = await supabase.from("monthly_audits").insert({
      user_id: userId,
      ...a,
    });
    if (error) {
      console.error(`  [×] monthly_audits ${a.target_month} 投入失敗:`, error.message);
      process.exit(1);
    }
  }
  console.log("  [✓] monthly_audits 4 件投入 (2-4 月完了 / 5 月未提出=アラート発火)");

  // ----- 9. lesson_progress (30+ 件完了 + 進行中 数件) -----
  const { data: lessons, error: lessonsErr } = await supabase
    .from("lessons")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(40);
  if (lessonsErr || !lessons || lessons.length === 0) {
    console.log("  [!] lessons が取得できなかった (skip lesson_progress)");
  } else {
    const completedLessons = lessons.slice(0, 32);
    const inProgressLessons = lessons.slice(32, 36);
    const progressRows = [];
    // 完了
    for (let i = 0; i < completedLessons.length; i++) {
      const completedDay = addDays(BODY_START.date, Math.floor(i * 3 + 5));
      progressRows.push({
        user_id: userId,
        lesson_id: completedLessons[i].id,
        is_completed: true,
        completed_at: `${completedDay}T20:00:00+09:00`,
        watched_seconds: 600,
        last_watched_at: `${completedDay}T20:00:00+09:00`,
      });
    }
    // 進行中
    for (let i = 0; i < inProgressLessons.length; i++) {
      progressRows.push({
        user_id: userId,
        lesson_id: inProgressLessons[i].id,
        is_completed: false,
        completed_at: null,
        watched_seconds: 180,
        last_watched_at: `2026-06-10T20:00:00+09:00`,
      });
    }
    const { error: lpErr } = await supabase.from("lesson_progress").insert(progressRows);
    if (lpErr) {
      console.error("  [×] lesson_progress 投入失敗:", lpErr.message);
      process.exit(1);
    }
    console.log(`  [✓] lesson_progress ${progressRows.length} 件投入 (完了 ${completedLessons.length} + 進行中 ${inProgressLessons.length})`);
  }

  // ----- 10. shipments 1 件投入 -----
  // shipments テーブルは「1 受講生 1 発送」 制約 (unique user_id)
  // → 「月 1 回ペースで 4 件」 は仕様としては美しいが現スキーマで不可能。
  //   よって入会時の歓迎ギフト 1 件のみを「発送済」 で投入。
  const { error: shipErr } = await supabase.from("shipments").insert({
    user_id: userId,
    postal_code: DEMO_POSTAL_CODE,
    prefecture: DEMO_PREFECTURE,
    city: DEMO_CITY,
    address_line: DEMO_ADDRESS_LINE,
    recipient_name: DEMO_NAME,
    status: "shipped",
    shipped_at: "2026-02-25T10:00:00+09:00",
    note: "デモ用 プロテイン歓迎ギフト",
  });
  if (shipErr) {
    console.error("  [×] shipments 投入失敗:", shipErr.message);
    process.exit(1);
  }
  console.log("  [✓] shipments 1 件投入 (= unique 制約により 1 件のみ)");

  // ----- 11. user_carte_request 1 件 pending 投入 -----
  const { error: crErr } = await supabase.from("user_carte_request").insert({
    user_id: userId,
    request_text:
      "最近 体重が戻ってきてしまったので、 重点部位を 腹 + 脚 中心に変更したいです。 ジムでスクワットも追加したい。",
    status: "pending",
  });
  if (crErr) {
    console.error("  [×] user_carte_request 投入失敗:", crErr.message);
    process.exit(1);
  }
  console.log("  [✓] user_carte_request 1 件 pending 投入");

  // ----- 12. messages (conversation + 数往復) -----
  // のり氏の admin id を取得 (superadmin より admin のり 優先)
  const { data: admins } = await supabase
    .from("admin_users")
    .select("id, role, name")
    .order("role", { ascending: true }); // admin → superadmin
  const noriAdmin = admins?.find((a) => a.name?.includes("のり")) ?? admins?.[0];
  if (noriAdmin) {
    // conversation 作成
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        last_message_at: "2026-06-08T21:30:00+09:00",
      })
      .select("id")
      .single();
    if (convErr) {
      console.error("  [×] conversations 作成失敗:", convErr.message);
    } else {
      const msgs = [
        {
          conversation_id: conv.id,
          sender_kind: "user",
          sender_id: userId,
          body: "のりさん、 5 月に入ってから体重が戻ってきてしまいました。 仕事の繁忙期で食事が乱れたのが原因な気がしています。",
          created_at: "2026-06-05T21:00:00+09:00",
        },
        {
          conversation_id: conv.id,
          sender_kind: "admin",
          sender_id: noriAdmin.id,
          body: "状況把握しました。 まず原因を切り分けましょう。 ① 食事の量 / ② タイミング / ③ 質、 どれが一番崩れていますか?",
          created_at: "2026-06-06T10:00:00+09:00",
        },
        {
          conversation_id: conv.id,
          sender_kind: "user",
          sender_id: userId,
          body: "①の量が一番大きいです。 接待で炭水化物 + アルコールが連続してしまいました。",
          created_at: "2026-06-07T19:30:00+09:00",
        },
        {
          conversation_id: conv.id,
          sender_kind: "admin",
          sender_id: noriAdmin.id,
          body: "了解です。 来週から接待が落ち着くなら、 カーボサイクルの low day を 2 → 3 日に増やして調整しましょう。 5 月の月次添削も忘れずに!",
          created_at: "2026-06-08T21:30:00+09:00",
        },
      ];
      const { error: msgErr } = await supabase.from("messages").insert(msgs);
      if (msgErr) {
        console.error("  [×] messages 投入失敗:", msgErr.message);
      } else {
        console.log(`  [✓] messages ${msgs.length} 往復投入 (conv: ${conv.id})`);
      }
    }
  } else {
    console.log("  [!] admin_users が取得できなかった (skip messages)");
  }

  // ===== アラート発火確認 =====
  console.log("");
  console.log("🔍 アラート発火確認");
  console.log("");

  // 1. 月次 5 月分 未提出
  const { data: may } = await supabase
    .from("monthly_audits")
    .select("submitted_at")
    .eq("user_id", userId)
    .eq("target_month", "2026-05-01")
    .single();
  const alert1 = may?.submitted_at === null;
  console.log(`  ${alert1 ? "✅" : "❌"} アラート①: 月次 5 月分 未提出 = ${alert1 ? "発火" : "発火しない"}`);

  // 2. body_metrics 最新 = 2026-06-12 / 今日から 10 日前
  const { data: latestBm } = await supabase
    .from("body_metrics")
    .select("recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();
  const today = new Date();
  const latestDays = latestBm ? daysBetween(latestBm.recorded_at, today.toISOString().slice(0, 10)) : 0;
  const alert2 = latestDays >= 7;
  console.log(`  ${alert2 ? "✅" : "❌"} アラート②: body_metrics 最新 = ${latestBm?.recorded_at} (${latestDays} 日前) ${alert2 ? "≥ 7 日 → 発火" : "< 7 日 → 発火しない"}`);

  // 3. goal_deviation
  const { data: gs } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", userId)
    .single();
  const target = gs?.content?.goal_selection?.target_weight_kg;
  const { data: latestWeight } = await supabase
    .from("body_metrics")
    .select("weight_kg, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();
  const deviation = target && latestWeight?.weight_kg
    ? Math.abs(((latestWeight.weight_kg - target) / target) * 100)
    : 0;
  const alert3 = deviation >= 7;
  console.log(`  ${alert3 ? "✅" : "❌"} アラート③: 目標乖離 ${deviation.toFixed(2)}% (目標 ${target}kg vs 直近 ${latestWeight?.weight_kg}kg) ${alert3 ? "≥ 7% → 発火" : "< 7% → 発火しない"}`);

  // 4. user_carte_request pending
  const { data: cr } = await supabase
    .from("user_carte_request")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending");
  const alert4 = (cr?.length ?? 0) > 0;
  console.log(`  ${alert4 ? "✅" : "❌"} アラート④: user_carte_request pending = ${cr?.length ?? 0} 件 ${alert4 ? "→ ハブで対応要" : "→ なし"}`);

  console.log("");
  console.log("✅ 完了");
  console.log("");
  console.log("📝 ログイン情報:");
  console.log(`   email   : ${DEMO_EMAIL}`);
  console.log(`   password: ${DEMO_PASSWORD}`);
  console.log("");
  console.log("🔗 受講生ハブ (admin 側):");
  console.log(`   https://juku.norifitness.com/admin/users/${userId}`);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
