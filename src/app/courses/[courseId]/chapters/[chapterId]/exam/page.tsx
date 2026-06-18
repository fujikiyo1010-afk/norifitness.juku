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
