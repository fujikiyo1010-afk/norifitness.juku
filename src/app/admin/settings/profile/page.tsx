import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * 設定 ・ プロフィールタブ
 *
 * MVP 実装: 表示のみ (編集は Should Have)
 */
export default async function ProfilePage() {
  const admin = await requireAdmin();

  return (
    <div className="p-7">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: "#00897b" }}
        />
        <h2 className="text-base font-bold text-zinc-900">プロフィール</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-6">
        管理者アカウントの基本情報
      </p>

      <div className="rounded-[10px] border border-[#e8ebe9] bg-white p-5 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-2xl">
          {admin.name.charAt(0)}
        </div>
        <div>
          <div className="text-base font-bold text-zinc-900">{admin.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5 font-mono">
            {admin.email}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            権限: {admin.role}
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white px-5 py-6 text-center">
        <div className="text-xs text-zinc-500">
          プロフィール編集機能は Should Have ・ MVP 後に追加予定
        </div>
      </div>
    </div>
  );
}
