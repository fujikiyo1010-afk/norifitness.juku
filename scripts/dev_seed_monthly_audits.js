/**
 * dev_seed_monthly_audits.js
 *
 * 開発・動作確認用に既存ユーザーへ複数月分の月次添削 (monthly_audits) を seed する。
 * 過去 5 ヶ月分: 未返答 3 件 + 返答済 2 件 を作成し、受信箱 + 個別画面 + 過去動画リスト の
 * 一通りの動作確認ができる状態にする。
 *
 * 使い方:
 *   node --env-file=.env.local scripts/dev_seed_monthly_audits.js
 *
 * 前提:
 *   - users テーブルに少なくとも 1 ユーザーが存在 (joined_at の古い順で最初の 1 人を使う)
 *   - 同じ user × target_month の audit は UNIQUE 制約により upsert (上書き) する
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 17 項目分のダミー回答 (リアル感あるサンプル、5 ヶ月分共通)
const SAMPLE_ITEMS = {
  q1: { last_value: 75.0, current_value: 73.8, text: "先月から 1.2kg 落とせました。停滞期もなく順調です。" },
  q2: { last_value: 82.5, current_value: 81.0, text: "ウエストも 1.5cm 落ちました。お腹周りはまだ気になります。" },
  q3: { score: 8, text: "食生活はだいぶ整ってきました。タンパク質を意識できています。" },
  q4: { score: 7, text: "加工品は週 2 回くらいまで。コンビニ弁当は減らせました。" },
  q5: { score: 7, text: "間食は週 1 のナッツとプロテインバーまで抑えられています。" },
  q6: { score: 9, text: "P150 / F60 / C240 を毎日キープできています。" },
  q7: { score: 6, text: "自炊は週 4 日。レシピ集から鶏むね照り焼きをよく作ります。" },
  q8: { score: 7, text: "週 3 回ジム死守。たまに 2 回になる週もあります。" },
  q9: { score: 6, text: "ベンチプレスは少しずつ増やしています。スクワット停滞中。" },
  q10: { score: 6, text: "フォームは Youtube を見直しながら調整中。" },
  q11: { score: 8, text: "平均 9000 歩。在宅日も意識的に散歩しています。" },
  q12: { score: 5, text: "仕事が忙しく 1 時就寝の日が多いです。平均 5.5 時間。" },
  q13: { score: 6, text: "スッキリ感はそこそこ。週末に寝溜めしてしまいます。" },
  q14: { score: 8, text: "マインドが落ち着いてきました。焦らず継続できる感覚。" },
  q15: { score: 7, text: "通勤時間に 1 日 1 本ペースで視聴できています。" },
  q16: { text: "来月は睡眠時間を 23:30 までに寝るルールを徹底したいです。" },
  q17: { text: "食事と運動は満足、休息だけがネック。仕事の優先順位を見直す月にします。" },
};

// 5 ヶ月分の audit を組み立てる
const N_DAYS_AGO = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const AUDITS = [
  // === 返答済 (過去 2 件、新しい順で並ぶ) ===
  {
    target_month: "2026-01-01",
    items: SAMPLE_ITEMS,
    submitted_at: "2026-02-03T09:00:00+09:00",
    nori_video_vimeo_url: "https://vimeo.com/dev-fake-001",
    nori_video_vimeo_id: "dev-fake-001",
    nori_video_published_at: "2026-02-10T14:00:00+09:00",
    nori_video_duration_sec: 245, // 4:05
  },
  {
    target_month: "2026-02-01",
    items: SAMPLE_ITEMS,
    submitted_at: "2026-03-02T09:00:00+09:00",
    nori_video_vimeo_url: "https://vimeo.com/dev-fake-002",
    nori_video_vimeo_id: "dev-fake-002",
    nori_video_published_at: "2026-03-08T14:00:00+09:00",
    nori_video_duration_sec: 168, // 2:48
  },
  // === 未返答 (古い順で 3 件、受信箱で並ぶ) ===
  {
    target_month: "2026-03-01",
    items: SAMPLE_ITEMS,
    submitted_at: N_DAYS_AGO(9),
    nori_video_vimeo_url: null,
    nori_video_vimeo_id: null,
    nori_video_published_at: null,
    nori_video_duration_sec: null,
  },
  {
    target_month: "2026-04-01",
    items: SAMPLE_ITEMS,
    submitted_at: N_DAYS_AGO(5),
    nori_video_vimeo_url: null,
    nori_video_vimeo_id: null,
    nori_video_published_at: null,
    nori_video_duration_sec: null,
  },
  {
    target_month: "2026-05-01",
    items: SAMPLE_ITEMS,
    submitted_at: N_DAYS_AGO(2),
    nori_video_vimeo_url: null,
    nori_video_vimeo_id: null,
    nori_video_published_at: null,
    nori_video_duration_sec: null,
  },
];

(async () => {
  // 既存ユーザーの最初の 1 人を取得
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, name, nickname")
    .order("joined_at", { ascending: true })
    .limit(1);

  if (userErr || !users || users.length === 0) {
    console.error("users テーブルにユーザーがいません。先にユーザー作成が必要です。");
    process.exit(1);
  }

  const user = users[0];
  console.log(`Target user: ${user.nickname || user.name} (${user.id})`);

  // 既存の audit を削除 (この user のみ)
  const { error: delErr } = await supabase
    .from("monthly_audits")
    .delete()
    .eq("user_id", user.id);
  if (delErr) console.warn("既存削除でエラー (続行):", delErr.message);

  // 5 ヶ月分を挿入
  const rows = AUDITS.map((a) => ({
    user_id: user.id,
    target_month: a.target_month,
    items: a.items,
    items_filled_count: Object.keys(a.items).length,
    last_saved_at: a.submitted_at,
    submitted_at: a.submitted_at,
    nori_video_vimeo_url: a.nori_video_vimeo_url,
    nori_video_vimeo_id: a.nori_video_vimeo_id,
    nori_video_published_at: a.nori_video_published_at,
    nori_video_duration_sec: a.nori_video_duration_sec,
  }));

  const { data, error } = await supabase
    .from("monthly_audits")
    .insert(rows)
    .select("id, target_month, submitted_at, nori_video_published_at");

  if (error) {
    console.error("Seed 失敗:", error);
    process.exit(1);
  }

  console.log(`\nSeeded ${data.length} audits:`);
  for (const r of data) {
    const status = r.nori_video_published_at ? "返答済" : "未返答";
    console.log(`  [${status}] ${r.target_month}  id=${r.id}`);
  }

  // 未返答のうち最古を URL 候補として表示
  const pending = data.filter((r) => !r.nori_video_published_at);
  pending.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  if (pending.length > 0) {
    console.log(
      `\n受信箱で最初に表示される行 (古い順):\n  http://localhost:3000/admin/monthly-reviews/${pending[0].id}`
    );
  }
})();
