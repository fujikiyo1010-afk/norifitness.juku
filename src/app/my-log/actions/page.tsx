import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyActions } from "@/lib/practice/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { ActionsClient } from "./ActionsClient";

export const dynamic = "force-dynamic";

/**
 * 実践リスト 一覧 (/my-log/actions) ・ 2026-06-18 線① #5 新設
 *
 * - タブ 「試してない / 試した」 (= Q3-A: 並び順 = 新しい順 / 試した日新しい順)
 * - チェック (□ → ✓) で即タブ移動 + 振り返りモーダル即出
 * - 振り返り任意、 削除可、 + 新規追加 (lesson_id=null) 可
 */
export default async function ActionsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-log/actions");

  const { untried, tried } = await listMyActions();

  return (
    <>
      <MemberHeader title="実践リスト" fallbackHref="/my-log" />
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          <p className="text-[12px] text-zinc-500 mb-4">
            レッスンで学んだことを「今週これを試す」 と宣言し、 試したら振り返りを残しましょう。
          </p>
          <ActionsClient untried={untried} tried={tried} />
        </div>
      </main>
    </>
  );
}
