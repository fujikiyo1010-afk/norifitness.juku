import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import {
  getExamForChapter,
  getExamFull,
  getMyLatestAttempt,
} from "@/lib/exams/queries";
import { ExamView } from "./ExamView";
import { EXAMS_ENABLED } from "@/lib/exams/feature";

export const dynamic = "force-dynamic";

/**
 * 試験画面 (2026-06-17 線① 試験機能 新設)
 *
 * URL: /courses/[courseId]/chapters/[chapterId]/exam
 *
 * - 章 ID から exam を 1 件取得 (lessons 経由)
 * - exam 全データ (questions + choices) を server で読み込み
 * - 自分の最新 attempt 取得 (合格判定 + 再受験 表示用)
 * - 残りは ExamView (client) で intro → questions → results の 3 状態
 *
 * exam がない章は 404。
 */
export default async function ExamPage({
  params,
}: {
  params: Promise<{ courseId: string; chapterId: string }>;
}) {
  const { courseId, chapterId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/courses/${courseId}/chapters/${chapterId}/exam`);
  }

  // 2026-07-14: 全体公開の準備で試験を一時封鎖。ここで早期returnし、
  // 以降の getExamFull(correct_choice_id を含む)を一切読み込まない=直URLでも答えは漏れない。
  if (!EXAMS_ENABLED) {
    return (
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
          <MemberHeader title="テスト" fallbackHref={`/courses/${courseId}`} />
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <div className="text-sm font-bold text-amber-800">
                理解度テストは準備中です
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-amber-700">
                現在このテストは一時的にお休みしています。
                <br />
                先に動画レッスンを進めて大丈夫です。
              </div>
              <Link
                href={`/courses/${courseId}`}
                className="mt-3 inline-block text-[12px] font-bold text-[#4a875b]"
              >
                コースに戻る →
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const examMeta = await getExamForChapter(chapterId);
  if (!examMeta) notFound();

  const [exam, latestAttempt, chapterRow] = await Promise.all([
    getExamFull(examMeta.id),
    getMyLatestAttempt(examMeta.id),
    supabase
      .from("chapters")
      .select("id, title, course_id")
      .eq("id", chapterId)
      .maybeSingle()
      .then((r) => r.data),
  ]);
  if (!exam) notFound();

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader
          title="テスト"
          fallbackHref={`/courses/${courseId}`}
        />

        <div className="px-4 pt-3 pb-2 text-[11px] text-[#6a6256]">
          <Link href={`/courses/${courseId}`} className="hover:underline">
            ← {chapterRow?.title ?? "章に戻る"}
          </Link>
        </div>

        <ExamView
          exam={exam}
          latestAttempt={latestAttempt}
          courseId={courseId}
          chapterId={chapterId}
        />
      </div>
    </main>
  );
}
