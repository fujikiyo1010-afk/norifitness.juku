export const dynamic = "force-dynamic";

/**
 * 管理画面 お問い合わせ ・ 件を選ぶ前の右側。
 * 一覧は layout(SupportShell) が持っているので、ここは空状態だけ。
 */
export default function AdminSupportIndexPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center">
      <div>
        <p className="text-[13px] text-zinc-500">左から問い合わせを選んでください</p>
        <p className="mt-2 text-[11.5px] text-zinc-400">
          返信すると「対応中」に移り、赤バッジから消えます
        </p>
      </div>
    </div>
  );
}
