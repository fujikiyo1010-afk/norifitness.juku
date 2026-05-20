import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchLessons } from "@/lib/courses/search";
import { getMyLessonProgress } from "@/lib/courses/queries";

// GET /api/search/lessons?q=keyword
//
// 受講生がライブ検索(タイプアヘッド)で叩く JSON API。
// 認証は Cookie ベース(Supabase session)で実施し、未ログインなら 401。
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [], query: "" }, { status: 200 });
  }

  const results = await searchLessons(q);
  const progressMap = await getMyLessonProgress(results.map((r) => r.id));

  return NextResponse.json(
    {
      query: q,
      results: results.map((r) => ({
        ...r,
        is_completed: progressMap.get(r.id) === true,
      })),
    },
    { status: 200 }
  );
}
