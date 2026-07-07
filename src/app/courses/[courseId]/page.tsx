import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  listPublicChapters,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import {
  getExamsByChapterIds,
  getMyExamPassesByChapterIds,
} from "@/lib/exams/queries";
import { createClient } from "@/lib/supabase/server";
import {
  type AccordionChapter,
  type AccordionExamInfo,
} from "./CourseAccordion";
import { CourseDetailView } from "./CourseDetailView";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string }>;

const nowIso = () => new Date().toISOString();

/**
 * コース別ヒーローテーマ (= 画像 + 色帯 + 帯上の文字色)
 * 色は比較ツール(/mock/hero-colors.html)で社員が画像から選定 (2026-07-07)。
 *   from/to  : 画像下の色帯 (単色は from==to / c1のみ縦グラデ)
 *   onBand   : 帯の上に乗る文字・進捗バーの色 (帯が明るいc2/c5はタイトル文字色を採用)
 *   ctaText  : 「続きから」ボタン(白地)の文字色
 * 画像は public/courses/c1〜c5.jpg (社員入稿 → 軽量JPG化済み)。
 */
type HeroTheme = {
  image: string | null;
  from: string;
  to: string;
  onBand: string;
  ctaText: string;
};

function pickHeroTheme(title: string): HeroTheme {
  if (title.includes("ボディメイク") || title.includes("ロードマップ"))
    // 緑・グラデ (#0b3618 → やや暗く)
    return { image: "/courses/c1.jpg", from: "#0b3618", to: "#082711", onBand: "#ffffff", ctaText: "#0b3618" };
  if (title.includes("live") || title.includes("LIVE") || title.includes("講義"))
    // 明るい青の帯・文字はタイトル「生徒…」のネイビー
    return { image: "/courses/c2.jpg", from: "#c9dce7", to: "#c9dce7", onBand: "#145ad2", ctaText: "#145ad2" };
  if (title.includes("マインドセット") || title.includes("コンテンツ"))
    // 紺・単色
    return { image: "/courses/c3.jpg", from: "#2c388f", to: "#2c388f", onBand: "#ffffff", ctaText: "#2c388f" };
  if (title.includes("フォーム") || title.includes("筋トレ"))
    // 暗赤・単色
    return { image: "/courses/c4.jpg", from: "#5b0c0e", to: "#5b0c0e", onBand: "#ffffff", ctaText: "#5b0c0e" };
  if (title.includes("レシピ") || title.includes("ダイエット"))
    // クリームの帯・文字はタイトル「ダイエット」のブラウン
    return { image: "/courses/c5.jpg", from: "#fbf2d0", to: "#fbf2d0", onBand: "#50320a", ctaText: "#50320a" };
  return { image: null, from: "#4a875b", to: "#34603f", onBand: "#ffffff", ctaText: "#34603f" }; // フォールバック
}

export default async function StudentCoursePage({
  params,
}: {
  params: RouteParams;
}) {
  const { courseId } = await params;

  const course = await getPublicCourse(courseId);
  if (!course) {
    notFound();
  }

  // 章一覧
  const chapters = await listPublicChapters(courseId);
  const chapterIds = chapters.map((c) => c.id);

  // 全章配下の公開済みレッスンを 1 クエリで取得
  const supabase = await createClient();
  const lessonsByChapter = new Map<string, AccordionChapter["lessons"]>();
  let allLessonIds: string[] = [];

  if (chapterIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, chapter_id, title, meta_tags, sort_order")
      .in("chapter_id", chapterIds)
      .or(`released_at.is.null,released_at.lte.${nowIso()}`)
      .order("sort_order", { ascending: true });

    (lessons ?? []).forEach((l) => {
      const arr = lessonsByChapter.get(l.chapter_id as string) ?? [];
      arr.push({
        id: l.id as string,
        title: l.title as string,
        meta_tags: (l.meta_tags as string[] | null) ?? null,
        sort_order: l.sort_order as number,
      });
      lessonsByChapter.set(l.chapter_id as string, arr);
    });
    allLessonIds = (lessons ?? []).map((l) => l.id as string);
  }

  // 進捗マップ
  const progressMap = await getMyLessonProgress(allLessonIds);
  const initialProgress: Record<string, boolean> = {};
  progressMap.forEach((v, k) => {
    initialProgress[k] = v;
  });

  // 章 sort_order → レッスン sort_order の順で「最初の未完了レッスン」 を探す ・ 「続きから」 CTA 用
  let firstUnfinished: {
    chapterId: string;
    lessonId: string;
    chapterSortOrder: number;
    lessonSortOrder: number;
    title: string;
  } | null = null;
  for (const ch of chapters) {
    const lessons = lessonsByChapter.get(ch.id) ?? [];
    for (const l of lessons) {
      if (!initialProgress[l.id]) {
        firstUnfinished = {
          chapterId: ch.id,
          lessonId: l.id,
          chapterSortOrder: ch.sort_order,
          lessonSortOrder: l.sort_order,
          title: l.title,
        };
        break;
      }
    }
    if (firstUnfinished) break;
  }

  // AccordionChapter 形式に組み立て
  const accordionChapters: AccordionChapter[] = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    sort_order: c.sort_order,
    lessons: lessonsByChapter.get(c.id) ?? [],
  }));

  // 章ごとの試験情報 + 受講生の合格状況 (試験機能 2026-06-17 線①)
  const [examsMap, passesMap] = await Promise.all([
    getExamsByChapterIds(chapterIds),
    getMyExamPassesByChapterIds(chapterIds),
  ]);
  const examsByChapterId: Record<string, AccordionExamInfo> = {};
  for (const [chId, exam] of examsMap.entries()) {
    const pass = passesMap.get(chId);
    examsByChapterId[chId] = {
      examId: exam.id,
      name: exam.name,
      lastPassed: pass ? pass.passed : null,
      lastFinishedAt: pass ? pass.finished_at : null,
    };
  }

  // コース全体の進捗集計
  const totalLessons = allLessonIds.length;
  const completedLessons = Object.values(initialProgress).filter(Boolean).length;
  const coursePercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // コース別ヒーローテーマ (画像 + 背景色)
  const hero = pickHeroTheme(course.title);

  return (
    <>
      <MemberHeader title="コース詳細" fallbackHref="/courses" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px] space-y-4">
        {/* ヒーロー (コース別カラー + 大サムネ画像 + 進捗 + 続きから CTA)
            フルブリード: ページ左右パディング(-mx)と上パディング(-mt)を打ち消し
            画面いっぱいの四角バナーに (角丸なし・ヘッダー直下に接地) */}
        <section
          className="-mt-4 -mx-4 sm:-mt-6 sm:-mx-6 overflow-hidden text-white p-3"
          style={{
            backgroundImage: `linear-gradient(180deg, ${hero.from}, ${hero.to})`,
          }}
        >
          {/* 大サムネ枠 (画像あり=入稿画像 / なし=線画プレースホルダ)
              画像は上・左右の色帯(p-3)を打ち消して全幅・角なし化 (-mt-3 -mx-3)。
              下側だけ色帯を残す (mb-3) → その上に%/進捗/CTAが乗る */}
          <div className="-mt-3 -mx-3 aspect-[16/9] bg-[#fffdf8]/15 overflow-hidden flex items-center justify-center mb-3">
            {hero.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.image}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/95"
              >
                <circle cx="13" cy="4" r="2" />
                <path d="M4 22 8.5 11l3 3 4-6 6 9" />
                <path d="m11.5 10.5 2-7" />
              </svg>
            )}
          </div>
          <div className="text-[11px] mb-2.5" style={{ color: hero.onBand }}>
            全体 {coursePercent}% ({completedLessons}/{totalLessons})
          </div>
          {/* 進捗バー (帯上の文字色 onBand で塗る = 明るい帯でも視認できる) */}
          <div
            className="h-1.5 rounded-full overflow-hidden mb-3"
            style={{ backgroundColor: `${hero.onBand}33` }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${coursePercent}%`, backgroundColor: hero.onBand }}
            />
          </div>
          {/* 続きから CTA */}
          {firstUnfinished ? (
            <Link
              href={`/courses/${courseId}/chapters/${firstUnfinished.chapterId}/lessons/${firstUnfinished.lessonId}`}
              className="block rounded-xl bg-[#fffdf8] py-3 px-4 text-sm font-bold text-center hover:bg-[#f0e6d3] transition-colors"
              style={{ color: hero.ctaText, boxShadow: `0 4px 0 ${hero.ctaText}80` }}
            >
              ▶ 続きから ・ L{firstUnfinished.lessonSortOrder}「
              {firstUnfinished.title}」
            </Link>
          ) : totalLessons > 0 ? (
            <div className="rounded-xl bg-[#fffdf8]/90 text-[#004d40] py-3 px-4 text-sm font-bold text-center">
              ✓ 全レッスン完了
            </div>
          ) : null}
        </section>

        {/* 説明 (任意) */}
        {course.description && (
          <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed px-1">
            {course.description}
          </p>
        )}

        <CourseDetailView
          courseId={courseId}
          chapters={accordionChapters}
          initialProgress={initialProgress}
          currentLessonId={firstUnfinished?.lessonId ?? null}
          examsByChapterId={examsByChapterId}
        />
        </div>
      </main>
    </>
  );
}
