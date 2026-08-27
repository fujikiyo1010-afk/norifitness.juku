/**
 * 撮影パネル(demo-panel)の中核ロジック — dev 専用
 *
 * ガイド動画の手動撮影用に、撮影専用デモ会員1名の状態をボタンで切り替える。
 *   基本の状態(作り直し): 入会前 / 入会直後 / 継続30日目 / 継続155日目
 *   トッピング(今の状態に乗せる): のりから返信が届いた日 / 月次を提出した直後
 *
 * 安全装置:
 *   - DEMO_PANEL_ENABLED: Supabase URL が dev(yciqbigyzfqmmjdcnqfk)の時だけ true。
 *     本番ではページ/APIとも 404 になる
 *   - 書き込み/削除はすべて撮影専用デモ垢(DEMO_EMAIL)の user_id に限定
 *   - 管理画面(/admin)には入れない(admin_users に登録しないため)
 *
 * 数値は scripts/demo-guide/seed_demo_members.mjs と同じ設計カーブ
 * (承認済みプラン: 62.0→59.8→停滞→57.2 / 週4〜5回・週末抜け / 再現性のある擬似乱数)。
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ABE_MEALS,
  ABE_MENU_CYCLES,
  ABE_MENU_NOTES,
  MEAL_PHOTO_FILES,
  BODY_PHOTO_FILES,
} from "./assets";

export const DEMO_PANEL_ENABLED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(
  "yciqbigyzfqmmjdcnqfk"
);
export const DEMO_PANEL_KEY = process.env.DEMO_PANEL_KEY || "nori2026";
export const DEMO_EMAIL = "demo.nori@example.com";
export const DEMO_NAME = "鈴木 一郎"; // 画面に映る名前(架空)
export const DEMO_PASSWORD = "demo-guide-2026";
// 撮影・テスト用の全デモ垢(グラフの丸なし表示などの対象)
export const DEMO_ACCOUNT_EMAILS = [
  DEMO_EMAIL,
  "demo.new@example.com",
  "demo.continuing@example.com",
];
// テスト用の月次返信動画(きよむさんから後日もらうVimeo URL。env優先)
export const DEMO_MONTHLY_VIMEO_URL = process.env.DEMO_NORI_VIMEO_URL || "";

const GOAL_DAYS = 300; // 目標日 = 入会から約10ヶ月後

export type DemoPreset = "pre_onboarding" | "fresh" | "day30" | "day155";
export type DemoTopping =
  | "nori_reply"
  | "monthly_open"      // 今の回を未提出に戻す(=リセット。記入・提出シーンが撮れる)
  | "monthly_submitted" // 今の回を提出済み・返信待ちに
  | "monthly_replied";  // 今の回を返信ありに(テスト用月次動画URLがあれば再生可)

export const PRESET_LABELS: Record<DemoPreset, string> = {
  pre_onboarding: "入会前(オンボーディングから)",
  fresh: "入会直後(まっさら)",
  day30: "継続30日目(第1回月次が開いた日)",
  day155: "継続155日目(データ豊富)",
};

// ── 日付ユーティリティ ────────────────────────────────────────────────
const DAY = 86400000;
// JST の今日を基準にする(サーバーはUTCで動くため+9hで日付を出す)
function jstDate(offsetDays = 0): Date {
  return new Date(Date.now() + 9 * 3600000 - offsetDays * DAY);
}
function ymdAgo(n: number): string {
  return jstDate(n).toISOString().slice(0, 10);
}
const jst = (dateStr: string, hm = "09:00") => `${dateStr}T${hm}:00+09:00`;

// 再現性のある擬似乱数(何度リセットしても同じ数字になる)
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 体組成の設計カーブ(seed_demo_members.mjs と同一) ──────────────────
function weightAt(t: number): number {
  if (t <= 30) return 62.0 - 2.2 * (t / 30);
  if (t <= 65) return 59.8 + 0.15 * Math.sin((t - 30) / 4.5);
  return 59.8 - 2.6 * ((t - 65) / 90);
}
const bfAt = (t: number) => 32.0 - (3.5 * Math.max(0, t - 10)) / 145;
const waistAt = (t: number) => 78.0 - 5.5 * (t / 155);

function buildBodyMetrics(userId: string, days: number) {
  const rand = mulberry32(20260825);
  const rows: Record<string, unknown>[] = [];
  // 「過去は埋める、今日は空ける」: 入会日〜昨日まで。週4〜5回・週末に抜けがち
  for (let d = days; d >= 1; d--) {
    const date = jstDate(d);
    const t = days - d;
    const dow = date.getUTCDay();
    const skipProb = t === 0 ? 0 : dow === 0 || dow === 6 ? 0.55 : 0.22;
    if (rand() < skipProb) continue;
    const noise = () => (rand() - 0.5) * 0.5;
    rows.push({
      user_id: userId,
      recorded_at: date.toISOString().slice(0, 10),
      weight_kg: Math.round((weightAt(t) + noise()) * 10) / 10,
      body_fat_percent: Math.round((bfAt(t) + noise() * 0.8) * 10) / 10,
      waist_cm: Math.round((waistAt(t) + noise() * 1.2) * 10) / 10,
      note: null,
    });
  }
  return rows;
}

// ── 目標シート(5/5記入+のり添削) ─────────────────────────────────────
const SELF_IMAGE_LABELS = [
  "自分の体に対して批判的な思考を減らし、ありのままの自分を受け入れることを学ぶ",
  "メディアで描かれる体のイメージが現実とは異なることを理解しその影響を減らす",
  "自分の体重やウエストを記録して客観的な数値の感覚を身につける",
  "自分の肉体はどうやって動くのか?どのような体型なのか?に関する意識を高める",
  "ボディイメージからくるストレスをやわらげる",
  "そもそもボディイメージとは何かを学ぶ",
  "自分が感じたネガティブなイメージを日記に書く",
  "ネガティブな感情をプラスの感情にする",
];
function goalSheetContent(days: number) {
  const joined = ymdAgo(days);
  const befores = [3, 4, 5, 3, 4, 2, 3, 4];
  const afters = [7, 8, 8, 7, 8, 6, 7, 8];
  return {
    current_status: {
      weight_kg: 62.0, height_cm: 158, waist_cm: 78, neck_cm: 31, hip_cm: 92,
      body_fat_pct: 32.0, maintenance_kcal: 1750, measured_at: joined,
    },
    goal_selection: {
      target_weight_kg: 54.0,
      target_date: ymdAgo(days - GOAL_DAYS),
      short_term: "まず3kg落として、去年のデニムをきれいに履けるようになる。",
      long_term: "半年後に体脂肪率20%台後半へ。疲れにくい体で、休日に全力で動ける自分になる。",
      process: "毎日写真で食事記録/週4回の家トレ/1日8000歩/体重は朝イチに測る",
    },
    nutrition: {
      target_calorie: 1500,
      pfc: { p: 100, f: 42, c: 160 },
      carb_cycle: { weekly_pattern: ["low", "mid", "high", "low", "mid", "high", "low"] },
    },
    positive_goals: {
      achievement_feeling: "試着室で服を選ぶのが楽しみになる。写真に写る自分を素直に好きと言える。",
    },
    self_image: SELF_IMAGE_LABELS.map((label, i) => ({
      key: `item_${i + 1}`, label, before: befores[i], after: afters[i],
    })),
    audits: {
      summary: {
        text: "良い目標設定です。プロセスが具体的で、停滞期の乗り越え方も身についてきました。この方針で続けましょう。",
        who: "のりfitness", date: ymdAgo(Math.max(1, days - 20)),
      },
      section_comments: {},
      field_comments: {
        short_term: {
          text: "「去年のデニム」という基準がとても良いです。数字だけでない目標は続きます。",
          who: "のりfitness", date: ymdAgo(Math.max(1, days - 20)),
        },
        pfc_f: {
          text: "脂質(F)がやや少なめです。魚やナッツから良質な脂を少し足すと、続けやすくなります。",
          who: "のりfitness", date: ymdAgo(Math.max(1, days - 20)),
        },
      },
    },
    filled_sections: ["current_status", "goal_selection", "nutrition", "positive_goals", "self_image"],
  };
}

// ── 月次添削(入会日起点30日サイクル・17項目) ─────────────────────────
const ROUNDS = [
  { n: 1, wLast: 62.0, wNow: 59.8, waLast: 78.0, waNow: 76.9, tone: "good",
    q17: "順調に落ちていて驚いています。このままのペースで大丈夫か、少し不安もあります。" },
  { n: 2, wLast: 59.8, wNow: 59.9, waLast: 76.9, waNow: 75.9, tone: "plateau",
    q17: "体重が1ヶ月ほぼ動きませんでした。何かを変えるべきか、このまま続けていいのか知りたいです。" },
  { n: 3, wLast: 59.9, wNow: 59.1, waLast: 75.9, waNow: 74.8, tone: "recover",
    q17: "停滞を抜けた気がします。外食が続く週の立て直し方が課題です。" },
  { n: 4, wLast: 59.1, wNow: 58.2, waLast: 74.8, waNow: 73.7, tone: "steady",
    q17: "焦らず続けられるようになってきました。トレの重量がなかなか伸びないのが気になります。" },
] as const;

function auditItems(r: (typeof ROUNDS)[number]) {
  const s = r.tone === "plateau"
    ? { diet: 6, ex: 7, rest: 5, mind: 5 }
    : r.tone === "good"
    ? { diet: 8, ex: 7, rest: 6, mind: 7 }
    : { diet: 7, ex: 8, rest: 6, mind: 8 };
  const txt = {
    good: ["食事記録が習慣になりました。", "たんぱく質を毎食意識できています。", "週4のトレを守れました。"],
    plateau: ["数字が動かず、少しモチベーションが落ちました。", "間食が増えた週がありました。", "トレは続けましたが気持ちが乗らない日も。"],
    recover: ["記録を続けたら、また動き始めました。", "外食の翌日に調整する型ができました。", "トレの習慣は完全に定着しました。"],
    steady: ["数字に一喜一憂しなくなりました。", "PFCの感覚が身につきました。", "休養日の使い方がうまくなりました。"],
  }[r.tone];
  return {
    q1: { last_value: r.wLast, current_value: r.wNow, text: `体重は ${r.wLast}kg → ${r.wNow}kg でした。` },
    q2: { last_value: r.waLast, current_value: r.waNow, text: `ウエストは ${r.waLast}cm → ${r.waNow}cm。少しずつ締まってきました。` },
    q3: { score: s.diet, text: txt[0] },
    q4: { score: s.diet - 1, text: "コンビニ食を減らして自炊を増やしました。" },
    q5: { score: s.diet, text: "間食はナッツかゆで卵に置き換え中。" },
    q6: { score: s.diet, text: "PFCはアプリのゲージを見ながら調整しています。" },
    q7: { score: s.diet - 1, text: "自炊は週5日ペース。" },
    q8: { score: s.ex, text: txt[2] },
    q9: { score: s.ex - 1, text: "ダンベルの重さを少しずつ上げています。" },
    q10: { score: s.ex - 1, text: "フォーム動画を見返して修正中。" },
    q11: { score: s.ex, text: "1日8000歩はほぼ達成。" },
    q12: { score: s.rest, text: "就寝が遅い日がまだあります。平均6.5時間。" },
    q13: { score: s.rest + 1, text: "寝起きは以前より軽くなりました。" },
    q14: { score: s.mind, text: txt[1] },
    q15: { score: s.mind, text: "通勤中にレッスン動画を見ています。" },
    q16: { text: r.tone === "plateau" ? "停滞期は誰にでも来ると学びました。" : "記録を続けること自体が力になると実感しています。" },
    q17: { text: r.q17 },
  };
}

async function insertChunks(table: string, rows: Record<string, unknown>[], size = 100) {
  const sb = createAdminClient();
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table} insert 失敗: ` + error.message);
  }
}

// ── デモ垢の確保 ─────────────────────────────────────────────────────
export async function ensureDemoUser(): Promise<string> {
  const sb = createAdminClient();
  const { data: u } = await sb.from("users").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  if (u) return u.id;
  // auth 側に残骸があれば拾う
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let id = list?.users?.find((x) => x.email === DEMO_EMAIL)?.id ?? null;
  if (!id) {
    const { data, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
    });
    if (error) throw new Error("デモ垢の作成に失敗: " + error.message);
    id = data.user.id;
  }
  const { error } = await sb.from("users").upsert({
    id, email: DEMO_EMAIL, name: DEMO_NAME, nickname: "いちろう",
    status: "active", joined_at: new Date().toISOString(), is_beta: true,
  });
  if (error) throw new Error("users upsert 失敗: " + error.message);
  await sb.from("user_profiles").upsert({ user_id: id });
  return id;
}

// ── データ全消し(デモ垢の行だけ) ─────────────────────────────────────
const WIPE_TABLES = [
  // 親→子の cascade があるものは親だけでよい(meal_log_items / workout_log_items / custom_menu_sets)
  "user_workout_logs", "user_custom_menus", "user_workout_progress", "user_workout_menu",
  "user_workout_carte", "user_carte_request", "user_workout_request", "user_favorite_exercises",
  "meal_logs", "daily_conditions", "daily_feedbacks", "feedback_bookmarks", "notifications",
  "monthly_audits", "goal_sheet_revisions", "goal_sheets", "body_photos", "body_metrics",
  "lesson_progress", "lesson_reviews", "tool_calculations", "shipments",
];
async function wipe(userId: string) {
  const sb = createAdminClient();
  for (const table of WIPE_TABLES) {
    // dev に無いテーブルや列差分はスキップ(エラーで止めない)
    await sb.from(table).delete().eq("user_id", userId);
  }
}

// ── 基本の状態(プリセット)を適用 ─────────────────────────────────────
export async function applyPreset(preset: DemoPreset): Promise<void> {
  const id = await ensureDemoUser();
  const sb = createAdminClient();
  await wipe(id);

  const days = preset === "day155" ? 155 : preset === "day30" ? 30 : 0;
  const joined = ymdAgo(days);
  await sb.from("users").update({ joined_at: jst(joined), updated_at: new Date().toISOString() }).eq("id", id);
  await sb.from("user_profiles").upsert({
    user_id: id, family_name: "鈴木", given_name: "一郎", birthday: "1990-06-15",
  });

  if (preset === "pre_onboarding") return; // shipments 無し → ログインすると /onboarding へ

  // 入会直後以降: オンボ通過の印(発送先)+カルテ
  await sb.from("shipments").insert({
    user_id: id, postal_code: "000-0000", prefecture: "（デモ）", city: "（デモ市区町村）",
    address_line: "（デモ番地）", recipient_name: DEMO_NAME, status: "shipped",
    shipped_at: jst(ymdAgo(Math.max(0, days - 3))),
  });
  await sb.from("user_workout_carte").insert({
    user_id: id, gender: "男", environments: ["ダンベル", "家トレ"], frequency_wish: "週4",
    focus_body_parts: ["胸", "腹筋"], purposes: ["ダイエット", "見た目改善"], experience: "たまに",
    medical_limits: [], ideal_body: "健康+適度に筋肉", menu_review_needed: false,
    created_at: jst(joined, "10:00"),
  });

  if (preset === "fresh") return; // 目標未記入・記録ゼロ・催促バナーが出る状態

  // 継続系(30日/155日): 目標シート+体組成+配布メニュー
  await sb.from("goal_sheets").insert({
    user_id: id, content: goalSheetContent(days),
    reviewed_at: jst(ymdAgo(Math.max(1, days - 20))),
    created_at: jst(ymdAgo(days - 2)), updated_at: jst(ymdAgo(Math.max(1, days - 20))),
  });

  const metrics = buildBodyMetrics(id, days);
  for (let i = 0; i < metrics.length; i += 50) {
    const { error } = await sb.from("body_metrics").insert(metrics.slice(i, i + 50));
    if (error) throw new Error("body_metrics insert 失敗: " + error.message);
  }

  // 配布メニュー = 阿部さんの現行メニュー。全期間「配布どおり完了」の実施記録を生成
  // (今日のぶんは入れない = 「今日のトレ未完了」で撮れる)
  const { data: menu } = await sb.from("user_workout_menu").insert({
    user_id: id, template_id: null, cycles: ABE_MENU_CYCLES,
    notes: ABE_MENU_NOTES, effective_from: jst(joined), is_current: true,
  }).select("id").single();
  if (menu) {
    type MenuDay = { 日?: string; 種目?: { 種目名?: string; 回数?: string }[] };
    const mid = ABE_MENU_CYCLES[1] ?? ABE_MENU_CYCLES[0];
    const week: MenuDay[] = (mid as { 週?: MenuDay[] })?.週 ?? [];
    const cycleLen = week.length || 7;
    await sb.from("user_workout_progress").upsert({
      user_id: id, menu_id: menu.id,
      current_day: (days % cycleLen) + 1, cycle_number: Math.floor(days / cycleLen) + 1,
      started_at: jst(joined, "08:00"), updated_at: new Date().toISOString(),
    });
    const wlogs: Record<string, unknown>[] = [];
    const witems: Record<string, unknown>[] = [];
    for (let t = 0; t < days; t++) {
      const dayIdx = t % cycleLen;
      const day = week[dayIdx];
      const exercises = day?.種目 ?? [];
      const isRest = exercises.length === 0 || String(day?.日 ?? "").includes("休");
      const logId = crypto.randomUUID();
      wlogs.push({
        id: logId, user_id: id, menu_id: menu.id, date: ymdAgo(days - t),
        day_number: dayIdx + 1, cycle_number: Math.floor(t / cycleLen) + 1,
        intensity: "medium", status: isRest ? "rest_done" : "done",
        completed_at: jst(ymdAgo(days - t), "20:00"),
      });
      if (!isRest) {
        exercises.forEach((ex, i) => {
          const m = String(ex.回数 ?? "").match(/(\d+)回.*?(\d+)セット/);
          witems.push({
            log_id: logId, exercise_name: ex.種目名 ?? "種目", source: "original",
            weight_kg: null, reps: m ? Number(m[1]) : null, sets: m ? Number(m[2]) : null,
            sort_order: i + 1,
          });
        });
      }
    }
    await insertChunks("user_workout_logs", wlogs);
    await insertChunks("user_workout_log_items", witems);
  }

  // 食事: 阿部さんの3パターンを日ごとに順番を変えて散りばめ(写真つき・たまに欠け)
  {
    const byType = new Map(ABE_MEALS.map((m) => [m.meal_type, m]));
    const rotations = [["朝", "昼", "夕"], ["昼", "夕", "朝"], ["夕", "朝", "昼"]] as const;
    const slotTime: Record<string, string> = { 朝: "07:45", 昼: "12:30", 夕: "19:30" };
    const mrand = mulberry32(20260826);
    const mlogs: Record<string, unknown>[] = [];
    const mitems: Record<string, unknown>[] = [];
    for (let t = 0; t < days; t++) {
      const date = ymdAgo(days - t);
      const rot = rotations[t % 3];
      (["朝", "昼", "夕"] as const).forEach((slot, si) => {
        if (mrand() < 0.12) return; // 記録しない食事もたまにある(リアルさ)
        const pat = byType.get(rot[si]);
        if (!pat) return;
        const logId = crypto.randomUUID();
        mlogs.push({
          id: logId, user_id: id, date, meal_type: slot,
          posted_at: jst(date, slotTime[slot]), memo: pat.memo ?? null,
          photos: [`${id}/${MEAL_PHOTO_FILES[pat.meal_type]}`],
        });
        (pat.items ?? []).forEach((it, i) => {
          mitems.push({
            meal_log_id: logId, name: it.name, source: it.source ?? "table",
            quantity: it.quantity, unit: it.unit, kcal: it.kcal,
            protein_g: it.protein_g, fat_g: it.fat_g, carb_g: it.carb_g,
            sort_order: it.sort_order ?? i,
          });
        });
      });
    }
    await insertChunks("meal_logs", mlogs);
    await insertChunks("meal_log_items", mitems);
  }

  // 体型写真: 入会時2枚 + 経過4枚を期間に均等配置(実ファイルはアップロード済みの固定素材)
  {
    const rows: Record<string, unknown>[] = BODY_PHOTO_FILES.join.map((f, i) => ({
      user_id: id, recorded_at: joined, storage_path: `${id}/${f}`,
      note: i === 0 ? "入会時" : null,
    }));
    BODY_PHOTO_FILES.progress.forEach((f, k) => {
      const t = Math.min(days - 1, Math.round((days * (k + 1)) / 5));
      rows.push({ user_id: id, recorded_at: ymdAgo(days - t), storage_path: `${id}/${f}`, note: null });
    });
    await insertChunks("body_photos", rows);
  }

  // 生活記録: 自動生成で毎日埋める(睡眠6〜7.5hのゆらぎ・たまに欠け)
  {
    const crand = mulberry32(20260827);
    const rows: Record<string, unknown>[] = [];
    for (let t = 0; t < days; t++) {
      if (crand() < 0.1) continue;
      const date = jstDate(days - t);
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      rows.push({
        user_id: id, date: ymdAgo(days - t),
        sleep_hours: [6, 6.5, 6.5, 7, 7, 7.5][Math.floor(crand() * 6)],
        condition: crand() < 0.7 ? "good" : crand() < 0.9 ? "normal" : "bad",
        bowel: crand() < 0.75 ? "yes" : crand() < 0.9 ? "constipated" : "no",
        alcohol: weekend && crand() < 0.4 ? "little" : "none",
      });
    }
    await insertChunks("daily_conditions", rows);
  }

  // 学習: 公開レッスンの先頭から順に完了を散りばめ(155日=70本/30日=18本)
  {
    const { data: pubCourses } = await sb.from("courses").select("id, sort_order").eq("is_published", true).order("sort_order");
    const courseIds = (pubCourses ?? []).map((c) => c.id);
    const { data: chapters } = await sb.from("chapters").select("id, course_id, sort_order").in("course_id", courseIds).order("sort_order");
    const chapterOrder = new Map((chapters ?? []).map((c, i) => [c.id, i]));
    const courseOrder = new Map(courseIds.map((cid, i) => [cid, i]));
    const chapterCourse = new Map((chapters ?? []).map((c) => [c.id, c.course_id]));
    const { data: lessons } = await sb.from("lessons").select("id, chapter_id, sort_order").in("chapter_id", [...chapterOrder.keys()]);
    const ordered = (lessons ?? []).sort((a, b) => {
      const ca = courseOrder.get(chapterCourse.get(a.chapter_id)) ?? 0;
      const cb = courseOrder.get(chapterCourse.get(b.chapter_id)) ?? 0;
      if (ca !== cb) return ca - cb;
      const ha = chapterOrder.get(a.chapter_id) ?? 0;
      const hb = chapterOrder.get(b.chapter_id) ?? 0;
      if (ha !== hb) return ha - hb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    const take = days >= 100 ? 70 : 18;
    const lrand = mulberry32(20260828);
    const rows = ordered.slice(0, take).map((l, k) => {
      const t = Math.min(days - 1, Math.round((days * k) / take));
      const when = jst(ymdAgo(days - t), "21:30");
      return {
        user_id: id, lesson_id: l.id, is_completed: true, completed_at: when,
        watched_seconds: 240 + Math.floor(lrand() * 420), last_watched_at: when,
      };
    });
    await insertChunks("lesson_progress", rows);
  }

  // 月次添削: 155日=第1〜4回 提出+返信済み(第5回は未提出) / 30日=なし(第1回が今日開いたところ)
  if (preset === "day155") {
    const audits = ROUNDS.map((r) => ({
      user_id: id,
      target_month: ymdAgo(days - 30 * r.n),
      items: auditItems(r),
      items_filled_count: 17,
      last_saved_at: jst(ymdAgo(days - 30 * r.n - 2), "21:00"),
      submitted_at: jst(ymdAgo(days - 30 * r.n - 2), "21:10"),
      nori_video_vimeo_url: null,
      nori_video_vimeo_id: null,
      nori_video_published_at: jst(ymdAgo(days - 30 * r.n - 5), "18:00"),
      nori_video_duration_sec: null,
    }));
    const { error } = await sb.from("monthly_audits").insert(audits);
    if (error) throw new Error("monthly_audits insert 失敗: " + error.message);
  }
}

// ── トッピング ───────────────────────────────────────────────────────
export async function applyTopping(topping: DemoTopping): Promise<string | null> {
  const id = await ensureDemoUser();
  const sb = createAdminClient();

  if (topping === "nori_reply") {
    // 昨日の記録にのりのコメント+未読通知 → ホームに掲示板/返信ありバッジ/NEW
    const yesterday = ymdAgo(1);
    await sb.from("daily_feedbacks").upsert(
      {
        user_id: id, date: yesterday,
        body: "昨日もしっかり記録できていますね。停滞しても記録を続けられているのが一番の力です。今日もいきましょう。",
        status: "sent", updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
    const { error } = await sb.from("notifications").insert({
      user_id: id, type: "comment",
      title: "のりから返信が届きました",
      body: "昨日の記録へのコメントが届いています。",
      link_url: `/meals?date=${yesterday}`,
      is_read: false,
    });
    if (error) throw new Error("notifications insert 失敗: " + error.message);
    return null;
  }

  // 月次3状態(未提出/提出済み・返信待ち/返信あり): いま開いている回を切り替える
  const { data: u } = await sb.from("users").select("joined_at").eq("id", id).single();
  const joinedMs = new Date(u!.joined_at).getTime();
  const daysSince = Math.floor((Date.now() - joinedMs) / DAY);
  const cycle = Math.min(6, Math.floor(daysSince / 30));
  if (cycle < 1) return "入会30日未満のため、まだ第1回が開いていません(継続30日目/155日目にしてから押してください)";
  const anchor = ymdAgo(daysSince - 30 * cycle);

  if (topping === "monthly_open") {
    const { error } = await sb.from("monthly_audits").delete().eq("user_id", id).eq("target_month", anchor);
    if (error) throw new Error("monthly_audits delete 失敗: " + error.message);
    return null;
  }

  const replied = topping === "monthly_replied";
  const vimeoId = replied && DEMO_MONTHLY_VIMEO_URL ? (DEMO_MONTHLY_VIMEO_URL.match(/(\d{6,})/)?.[1] ?? null) : null;
  const { error } = await sb.from("monthly_audits").upsert(
    {
      user_id: id, target_month: anchor,
      items: auditItems(ROUNDS[Math.min(3, cycle - 1)]),
      items_filled_count: 17,
      last_saved_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      nori_video_vimeo_url: replied ? (DEMO_MONTHLY_VIMEO_URL || null) : null,
      nori_video_vimeo_id: vimeoId,
      nori_video_published_at: replied ? new Date().toISOString() : null,
      nori_video_duration_sec: replied && DEMO_MONTHLY_VIMEO_URL ? 240 : null,
    },
    { onConflict: "user_id,target_month" }
  );
  if (error) throw new Error("monthly_audits upsert 失敗: " + error.message);
  return null;
}

/** オンボ完了扱いの印(発送先+カルテ)だけ足してホームに入れるようにする。他のデータは触らない */
export async function forceHome(): Promise<void> {
  const id = await ensureDemoUser();
  const sb = createAdminClient();
  const { data: ship } = await sb.from("shipments").select("id").eq("user_id", id).maybeSingle();
  if (!ship) {
    await sb.from("shipments").insert({
      user_id: id, postal_code: "000-0000", prefecture: "（デモ）", city: "（デモ市区町村）",
      address_line: "（デモ番地）", recipient_name: DEMO_NAME, status: "shipped",
      shipped_at: new Date().toISOString(),
    });
  }
  const { data: carte } = await sb.from("user_workout_carte").select("user_id").eq("user_id", id).maybeSingle();
  if (!carte) {
    await sb.from("user_workout_carte").insert({
      user_id: id, gender: "男", environments: ["ダンベル", "家トレ"], frequency_wish: "週4",
      focus_body_parts: ["胸", "腹筋"], purposes: ["ダイエット", "見た目改善"], experience: "たまに",
      medical_limits: [], ideal_body: "健康+適度に筋肉", menu_review_needed: false,
    });
  }
}

// ── 現在の状態(パネル表示用) ─────────────────────────────────────────
export async function getDemoState() {
  const sb = createAdminClient();
  const { data: u } = await sb
    .from("users").select("id, joined_at").eq("email", DEMO_EMAIL).maybeSingle();
  if (!u) return { exists: false as const };
  const id = u.id;
  const daysSince = Math.floor((Date.now() - new Date(u.joined_at).getTime()) / DAY);
  const [bm, ship, goal, audits, notif, menu] = await Promise.all([
    sb.from("body_metrics").select("recorded_at", { count: "exact" }).eq("user_id", id).order("recorded_at", { ascending: false }).limit(1),
    sb.from("shipments").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("goal_sheets").select("user_id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("monthly_audits").select("target_month, submitted_at, nori_video_published_at").eq("user_id", id),
    sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", id).eq("is_read", false),
    sb.from("user_workout_menu").select("id", { count: "exact", head: true }).eq("user_id", id).eq("is_current", true),
  ]);
  const submitted = (audits.data ?? []).filter((a) => a.submitted_at);
  const cycleNow = Math.min(6, Math.floor(daysSince / 30));
  const anchorNow = cycleNow >= 1 ? ymdAgo(daysSince - 30 * cycleNow) : null;
  const currentRow = anchorNow ? (audits.data ?? []).find((a) => String(a.target_month).slice(0, 10) === anchorNow) : null;
  const currentCycleStatus = !anchorNow
    ? "not_yet"
    : !currentRow || !currentRow.submitted_at
    ? "open"
    : currentRow.nori_video_published_at
    ? "replied"
    : "submitted";
  return {
    currentCycleStatus,
    exists: true as const,
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    daysSince,
    onboarded: (ship.count ?? 0) > 0,
    bmCount: bm.count ?? 0,
    bmLast: bm.data?.[0]?.recorded_at ?? null,
    goalFilled: (goal.count ?? 0) > 0,
    auditsSubmitted: submitted.length,
    auditsReplied: submitted.filter((a) => a.nori_video_published_at).length,
    awaitingReply: submitted.filter((a) => !a.nori_video_published_at).length,
    unreadCount: notif.count ?? 0,
    menuDistributed: (menu.count ?? 0) > 0,
    currentCycle: Math.min(6, Math.floor(daysSince / 30)),
  };
}
