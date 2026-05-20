import { createClient } from "@/lib/supabase/server";

const nowIso = () => new Date().toISOString();

export type SearchResult = {
  id: string;
  title: string;
  description: string | null;
  meta_tags: string[] | null;
  sort_order: number;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
  match_priority: 1 | 2 | 3; // 1=title, 2=tag, 3=description
};

/**
 * 受講生視点でレッスンを検索する。
 *
 * 検索対象:
 * - lessons.title       (部分一致 ILIKE)
 * - lessons.description (部分一致 ILIKE)
 * - lessons.meta_tags   (jsonb 配列要素の完全一致 contains)
 *
 * フィルタ(段階公開準拠):
 * - courses.is_published = true
 * - chapters.released_at が NULL or 過去
 * - lessons.released_at  が NULL or 過去
 *
 * オプション scope:
 * - courseId 指定時はそのコース内のレッスンのみ検索対象
 *
 * 並び順: タイトル一致 > タグ一致 > 説明文一致、各内で sort_order
 */
export async function searchLessons(
  query: string,
  options: { courseId?: string } = {}
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const supabase = await createClient();
  const now = nowIso();

  // 1. 公開コース取得(courseId 指定時はそのコースのみ)
  let courseQuery = supabase
    .from("courses")
    .select("id, title")
    .eq("is_published", true);
  if (options.courseId) {
    courseQuery = courseQuery.eq("id", options.courseId);
  }
  const { data: courses } = await courseQuery;
  if (!courses || courses.length === 0) return [];
  const courseMap = new Map<string, string>(
    courses.map((c) => [c.id as string, c.title as string])
  );

  // 2. 公開済み章を取得
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, course_id, title")
    .in("course_id", Array.from(courseMap.keys()))
    .or(`released_at.is.null,released_at.lte.${now}`);
  if (!chapters || chapters.length === 0) return [];
  const chapterMap = new Map<
    string,
    { id: string; course_id: string; title: string }
  >(
    chapters.map((c) => [
      c.id as string,
      {
        id: c.id as string,
        course_id: c.course_id as string,
        title: c.title as string,
      },
    ])
  );
  const chapterIds = Array.from(chapterMap.keys());

  // 3. タイトル/説明 部分一致でレッスン検索
  // PostgREST の or 構文で title.ilike か description.ilike を OR 結合
  // ※ ILIKE の % は URL エンコードでも問題なし
  const pattern = `*${escapeIlikeWildcards(q)}*`;
  const { data: textMatches } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, meta_tags, sort_order"
    )
    .in("chapter_id", chapterIds)
    .or(`released_at.is.null,released_at.lte.${now}`)
    .or(`title.ilike.${pattern},description.ilike.${pattern}`);

  // 4. タグ完全一致でレッスン検索(配列要素の含有)
  const { data: tagMatches } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, meta_tags, sort_order"
    )
    .in("chapter_id", chapterIds)
    .or(`released_at.is.null,released_at.lte.${now}`)
    .contains("meta_tags", [q]);

  // 5. マージ + 優先度判定
  type Row = {
    id: string;
    chapter_id: string;
    title: string;
    description: string | null;
    meta_tags: string[] | null;
    sort_order: number;
  };
  const all: Row[] = [
    ...((textMatches ?? []) as Row[]),
    ...((tagMatches ?? []) as Row[]),
  ];

  const dedup = new Map<string, Row>();
  for (const r of all) {
    if (!dedup.has(r.id)) dedup.set(r.id, r);
  }

  const lowerQ = q.toLowerCase();
  const results: SearchResult[] = [];
  for (const r of dedup.values()) {
    const ch = chapterMap.get(r.chapter_id);
    if (!ch) continue;
    const courseTitle = courseMap.get(ch.course_id);
    if (!courseTitle) continue;

    // 優先度判定
    let priority: 1 | 2 | 3 = 3;
    if (r.title.toLowerCase().includes(lowerQ)) {
      priority = 1;
    } else if ((r.meta_tags ?? []).some((t) => t.toLowerCase() === lowerQ)) {
      priority = 2;
    } else {
      priority = 3;
    }

    results.push({
      id: r.id,
      title: r.title,
      description: r.description,
      meta_tags: r.meta_tags,
      sort_order: r.sort_order,
      chapter_id: ch.id,
      chapter_title: ch.title,
      course_id: ch.course_id,
      course_title: courseTitle,
      match_priority: priority,
    });
  }

  // 6. 並び替え: 優先度 → sort_order
  results.sort((a, b) => {
    if (a.match_priority !== b.match_priority) {
      return a.match_priority - b.match_priority;
    }
    return a.sort_order - b.sort_order;
  });

  return results;
}

/** ILIKE の特殊文字 (_, %) をエスケープ */
function escapeIlikeWildcards(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}
