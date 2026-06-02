import { redirect } from "next/navigation";
import { getMyCarte } from "@/lib/workout/queries";
import { CarteIntakeForm } from "./CarteIntakeForm";

export const dynamic = "force-dynamic";

/**
 * 受講生カルテ初回入力画面 (/workout/carte/new)
 *
 * 役割:
 *   - 受講生が初めてカルテを記入するページ
 *   - 既にカルテを提出済の場合はカルテ閲覧画面 (or /workout) にリダイレクト
 *   - 提出後は /workout/carte/complete に遷移
 *
 * 設計元:
 *   - 2026-06-01 きよむさんとの言語化合意
 *   - A 案: 1 画面でスクロール / 下書き保存あり (localStorage) / 必須項目チェック
 */
export default async function WorkoutCarteNewPage() {
  // 既にカルテがある場合はリダイレクト (重複提出防止)
  const existing = await getMyCarte();
  if (existing) {
    redirect("/workout/carte");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CarteIntakeForm />
    </div>
  );
}
