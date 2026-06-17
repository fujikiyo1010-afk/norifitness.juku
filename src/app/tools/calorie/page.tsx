import { getMyToolCalculation } from "@/lib/tools/queries";
import type { CalorieInputs, CalorieOutputs } from "@/lib/tools/types";
import { CalorieToolClient } from "./CalorieToolClient";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "必要カロリー計算 | 筋肉塾",
};

/**
 * 必要カロリー計算ツール (/tools/calorie)
 *
 * Server Component: 前回計算結果を取得して Client に渡す。
 * UI と計算ロジックは CalorieToolClient (Client) で実装。
 *
 * 単独モード = 目標シートとは完全分離。
 * 目標シート編集画面からはモーダルで別 Client を呼び出す予定 (Step 10f)。
 */
export default async function CalorieToolPage() {
  const previous = await getMyToolCalculation<CalorieInputs, CalorieOutputs>(
    "calorie"
  );

  return (
    <>
      <MemberHeader title="必要カロリー計算" fallbackHref="/tools" />
      <CalorieToolClient previous={previous} />
    </>
  );
}
