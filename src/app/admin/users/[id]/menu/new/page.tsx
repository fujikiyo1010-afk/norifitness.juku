import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMenuForAdmin } from "@/lib/workout/queries";
import { defaultNoriNote } from "@/lib/workout/menu-display";
import type { WorkoutTemplateRow, WorkoutCycles } from "@/lib/workout/types";
import { MenuComposeClient } from "./MenuComposeClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 メニュー配布 (/admin/users/[id]/menu/new?template=xxx)
 *
 * 役割:
 *   - マッチング検索で採用したテンプレ or 現メニューをベースに編集
 *   - のり氏が種目を微調整 (削除 / 追加 / 順序変更 / テキスト編集)
 *   - のり氏メモを入力 (デフォルトテンプレ文を自動セット、編集可)
 *   - 配布実行 → distributeMenu Server Action → 受講生に配布
 *
 * クエリパラメータ (どれか 1 つ):
 *   - template: テンプレ id (採用するベーステンプレ)
 *   - from_scratch: 1 のとき、ゼロから手作りモード (空テンプレ)
 *   - from_current: 1 のとき、現メニューをベースに編集 (案 B、軽い修正用)
 *
 * アクセス制御: requireAdmin
 */
export default async function AdminMenuNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    template?: string;
    from_scratch?: string;
    from_current?: string;
  }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;
  const sp = await searchParams;

  // 受講生取得
  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, name, nickname")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) {
    notFound();
  }

  // 採用したテンプレ取得 (or ゼロから)
  let initialCycles: WorkoutCycles = [];
  let initialNotes = "";
  let templateId: string | null = null;
  let sourceTemplate: WorkoutTemplateRow | null = null;

  if (sp.from_current === "1") {
    // 案 B: 現メニューをベースに編集 (軽い修正向け)
    const currentMenu = await getCurrentMenuForAdmin(userId);
    if (!currentMenu) {
      return (
        <div className="min-h-screen bg-zinc-50 p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-bold text-zinc-900">
              メニュー編集
            </h1>
            <div className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 p-6">
              <p className="text-sm text-amber-900 mb-3">
                編集する現メニューがありません。
                先にメニューを配布してください。
              </p>
              <Link
                href={`/admin/users/${userId}/match`}
                className="inline-block rounded-[4px] bg-[#00897b] text-white px-4 py-2 text-sm font-bold hover:bg-[#00695c]"
              >
                マッチング検索へ
              </Link>
            </div>
          </div>
        </div>
      );
    }
    initialCycles = currentMenu.cycles || [];
    initialNotes = currentMenu.notes ?? defaultNoriNote(initialCycles.length);
    // 既存メニューが何かのテンプレを元にしていたら snapshot を引き継ぐ
    sourceTemplate = currentMenu.template_snapshot;
    templateId = currentMenu.template_id;
  } else if (sp.from_scratch === "1") {
    // ゼロから: 最小構成 1 サイクル × 1 日 × 0 種目
    initialCycles = [
      {
        段階: "メニュー",
        シート名: "",
        週: [
          {
            日: "A メニュー",
            種目: [],
          },
        ],
      },
    ];
    initialNotes = defaultNoriNote(1);
  } else if (sp.template) {
    const { data: tpl } = await admin
      .from("workout_templates")
      .select("*")
      .eq("id", sp.template)
      .maybeSingle();
    if (!tpl) {
      notFound();
    }
    sourceTemplate = tpl as WorkoutTemplateRow;
    initialCycles = (tpl.cycles as WorkoutCycles) || [];
    initialNotes = defaultNoriNote(initialCycles.length);
    templateId = tpl.id;
  } else {
    // template も from_scratch もない → マッチング画面に戻す
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-bold text-zinc-900">
            メニュー配布
          </h1>
          <div className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-900 mb-3">
              ベースにするテンプレが指定されていません。
              まずマッチング検索でテンプレを採用してください。
            </p>
            <Link
              href={`/admin/users/${userId}/match`}
              className="inline-block rounded-[4px] bg-[#00897b] text-white px-4 py-2 text-sm font-bold hover:bg-[#00695c]"
            >
              マッチング検索へ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 戻り先: 現メニュー編集の場合はハブ、それ以外 (テンプレ採用/ゼロから) はマッチング検索
  const backHref =
    sp.from_current === "1"
      ? `/admin/users/${userId}`
      : `/admin/users/${userId}/match`;

  return (
    <MenuComposeClient
      userId={userId}
      userName={userRow.nickname || userRow.name}
      initialCycles={initialCycles}
      initialNotes={initialNotes}
      templateId={templateId}
      sourceTemplate={sourceTemplate}
      backHref={backHref}
    />
  );
}
