"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveReviewInput = {
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
};

export type SaveReviewResult =
  | { ok: true; updated_at: string }
  | { ok: false; message: string };

const MAX_FIELD_LENGTH = 5000;

/**
 * 3 行振り返りを upsert する。
 * 1 ユーザー × 1 レッスン = 1 レコード(unique 制約)、編集時は同一行上書き。
 * RLS により他人のレコードは触れない設計。
 */
export async function saveReview(
  lessonId: string,
  input: SaveReviewInput
): Promise<SaveReviewResult> {
  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return { ok: false, message: "lesson_id が不正です" };
  }

  // バリデーション: 文字数上限のみ。空の組み合わせは UI 側で弾く
  for (const [name, val] of [
    ["learned", input.learned],
    ["impressed", input.impressed],
    ["next_action", input.next_action],
  ] as const) {
    if (val && val.length > MAX_FIELD_LENGTH) {
      return {
        ok: false,
        message: `${name} は ${MAX_FIELD_LENGTH} 文字以内にしてください`,
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const { data, error } = await supabase
    .from("lesson_reviews")
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        learned: input.learned,
        impressed: input.impressed,
        next_action: input.next_action,
      },
      { onConflict: "user_id,lesson_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(
    `/courses/[courseId]/chapters/[chapterId]/lessons/${lessonId}`,
    "page"
  );
  // 振り返り一覧 + 学習ハブ も更新 (BackLink で戻った時に最新表示)
  revalidatePath("/my-log/reviews");
  revalidatePath("/my-log");
  return { ok: true, updated_at: data.updated_at as string };
}
