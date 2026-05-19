// Phase 2-2: 実データ風ダミー seed
// 目的: スキーマ検証 + Phase 2-3 受講生 UI 構築の足場
// 使い方: cd 06_kinniku_juku_app && source .env.local && node /tmp/seed_phase2_2.js

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("env vars not set");
  process.exit(1);
}

const s = createClient(url, key);

const COURSE = {
  title: "限定ボディメイク完全ロードマップ動画",
  description:
    "のりfitness 受講生限定の体系的ボディメイクガイド。\n基礎理論から実践種目まで、約 200 レッスンで網羅。",
  sort_order: 100,
  is_published: true,
};

const CHAPTERS = [
  {
    title: "0. はじめに必ず視聴して下さい",
    description: "目標設定とサポートツールの使い方を最初に確認してください。",
    sort_order: 10,
    released_at: null, // 即公開
    lessons: [
      {
        title: "ようこそ筋肉塾へ",
        description:
          "受講開始にあたって、まず最初にご視聴ください。\n半年でボディメイクを完成させるための全体マップを 8 分で解説します。",
        vimeo_url: "https://vimeo.com/dummy/welcome",
        meta_tags: ["イントロ", "必須"],
      },
      {
        title: "目標シートの書き方",
        description:
          "受講開始時に必ず記入していただく目標シートの書き方を解説。\nマイページから書けます。",
        vimeo_url: "https://vimeo.com/dummy/goal-sheet",
        meta_tags: ["イントロ", "目標設定"],
      },
      {
        title: "サポートツールの使い方(カロミル・バーンフィット)",
        description:
          "食事記録のカロミル、運動記録のバーンフィットの導入方法と毎日の使い方。",
        vimeo_url: "https://vimeo.com/dummy/tools",
        meta_tags: ["イントロ", "ツール"],
      },
    ],
  },
  {
    title: "1. 食事の基礎 — PFC バランスと摂取カロリー",
    description:
      "ボディメイクの 7 割は食事で決まります。まずは PFC の考え方から。",
    sort_order: 20,
    released_at: null,
    lessons: [
      {
        title: "PFC とは何か",
        description:
          "Protein(タンパク質) / Fat(脂質) / Carb(炭水化物) の三大栄養素について。",
        vimeo_url: "https://vimeo.com/dummy/pfc-basics",
        sub_image_url: "https://example.com/images/pfc-chart.png",
        meta_tags: ["食事", "栄養学", "基礎"],
      },
      {
        title: "自分の摂取カロリーの計算方法",
        description:
          "基礎代謝 + 活動量から TDEE を求める計算式の解説。\n計算例を 3 パターン示します。",
        vimeo_url: "https://vimeo.com/dummy/calorie-calc",
        meta_tags: ["食事", "カロリー", "計算"],
      },
      {
        title: "タンパク質の重要性",
        description: "筋肉維持・発達に必須のタンパク質摂取量と質について。",
        vimeo_url: "https://vimeo.com/dummy/protein",
        meta_tags: ["食事", "タンパク質"],
      },
    ],
  },
  {
    title: "2. トレーニング種目集 — 基本 BIG3",
    description: "ベンチプレス / スクワット / デッドリフトの基本フォーム。",
    sort_order: 30,
    released_at: null,
    lessons: [
      {
        title: "ベンチプレス",
        description:
          "胸の最大種目。バーの軌道と肩甲骨の使い方を重点解説。\n初心者がやりがちなフォームミスも紹介。",
        vimeo_url: "https://vimeo.com/dummy/bench-press",
        summary_video_url: "https://vimeo.com/dummy/bench-press-summary",
        sub_image_url: "https://example.com/images/bench-press-anatomy.png",
        meta_tags: ["胸", "上半身", "BIG3", "コンパウンド"],
      },
      {
        title: "スクワット",
        description:
          "脚の王様種目。膝とつま先の向き、深さ、重心バランスの基本。",
        vimeo_url: "https://vimeo.com/dummy/squat",
        summary_video_url: "https://vimeo.com/dummy/squat-summary",
        meta_tags: ["脚", "下半身", "BIG3", "コンパウンド"],
      },
      {
        title: "デッドリフト",
        description:
          "背中・脚・体幹を総動員する全身種目。腰を守るフォームを最優先に。",
        vimeo_url: "https://vimeo.com/dummy/deadlift",
        meta_tags: ["背中", "脚", "BIG3", "コンパウンド", "高重量"],
      },
    ],
  },
  {
    title: "3. 応用編 — 部位別の追加種目(月末公開予定)",
    description: "BIG3 をマスターした後に取り組む応用種目集。段階公開。",
    sort_order: 40,
    released_at: new Date("2026-06-01T00:00:00+09:00").toISOString(),
    lessons: [
      {
        title: "インクラインベンチプレス",
        description: "上部胸を狙う種目。角度設定のコツ。",
        vimeo_url: "https://vimeo.com/dummy/incline-bench",
        meta_tags: ["胸", "上半身", "応用"],
      },
      {
        title: "ブルガリアンスクワット",
        description: "片脚スクワット。左右差を矯正する効果あり。",
        vimeo_url: "https://vimeo.com/dummy/bulgarian-squat",
        meta_tags: ["脚", "下半身", "応用", "片脚"],
      },
    ],
  },
];

(async () => {
  // 1. Course
  const { data: course, error: cErr } = await s
    .from("courses")
    .insert(COURSE)
    .select()
    .single();
  if (cErr) {
    console.error("course error:", cErr.message);
    process.exit(1);
  }
  console.log("✅ Course:", course.title);

  // 2. Chapters + Lessons
  let chapterCount = 0;
  let lessonCount = 0;
  for (const ch of CHAPTERS) {
    const { data: chapter, error: chErr } = await s
      .from("chapters")
      .insert({
        course_id: course.id,
        title: ch.title,
        description: ch.description,
        sort_order: ch.sort_order,
        released_at: ch.released_at,
      })
      .select()
      .single();
    if (chErr) {
      console.error("chapter error:", chErr.message);
      continue;
    }
    chapterCount++;
    console.log("  ✅ Chapter:", chapter.title);

    let lsort = 10;
    for (const l of ch.lessons) {
      const { error: lErr } = await s.from("lessons").insert({
        chapter_id: chapter.id,
        title: l.title,
        description: l.description ?? null,
        vimeo_url: l.vimeo_url ?? null,
        summary_video_url: l.summary_video_url ?? null,
        sub_image_url: l.sub_image_url ?? null,
        meta_tags: l.meta_tags ?? null,
        sort_order: lsort,
        released_at: null,
      });
      if (lErr) {
        console.error("    lesson error:", lErr.message);
        continue;
      }
      lessonCount++;
      console.log("    ✅ Lesson:", l.title);
      lsort += 10;
    }
  }

  console.log(
    `\n--- 完了: 1 コース / ${chapterCount} 章 / ${lessonCount} レッスン ---`
  );
})();
