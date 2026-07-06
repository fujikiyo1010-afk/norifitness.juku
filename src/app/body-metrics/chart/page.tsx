import { redirect } from "next/navigation";

/**
 * 旧・体組成推移グラフ画面は廃止 (2026-07-06)。
 * グラフは /record の詳細画面に内包。直アクセスは新画面へ。
 */
export default function BodyMetricsChartRedirect() {
  redirect("/record");
}
