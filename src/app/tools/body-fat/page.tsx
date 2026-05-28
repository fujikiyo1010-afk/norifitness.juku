import { getMyToolCalculation } from "@/lib/tools/queries";
import type { BodyFatInputs, BodyFatOutputs } from "@/lib/tools/types";
import { BodyFatToolClient } from "./BodyFatToolClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "体脂肪率計算 | 筋肉塾",
};

/**
 * 体脂肪率計算ツール (/tools/body-fat)
 *
 * Server Component: 前回計算結果を取得して Client に渡す。
 * UI と計算ロジックは BodyFatToolClient (Client) で実装。
 *
 * このページは「単独モード」専用。目標シート編集画面からはモーダルで
 * 別 Client コンポーネントを呼び出す予定 (Step 10f)。
 */
export default async function BodyFatToolPage() {
  const previous = await getMyToolCalculation<BodyFatInputs, BodyFatOutputs>(
    "body_fat"
  );

  return <BodyFatToolClient previous={previous} />;
}
