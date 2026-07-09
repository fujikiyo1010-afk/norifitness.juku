import { redirect } from "next/navigation";

/**
 * 旧・体組成記録画面は廃止 (2026-07-06 体組成セクション改修で /record に一本化)。
 * ブックマーク等の直アクセスは新画面へ送る。
 */
export default function BodyMetricsRedirect() {
  redirect("/record");
}
