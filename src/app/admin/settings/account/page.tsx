export default function AccountPage() {
  return (
    <div className="p-7">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: "#71717a" }}
        />
        <h2 className="text-base font-bold text-zinc-900">アカウント</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-6">
        パスワード変更 ・ ログアウト ・ アカウント削除 等
      </p>

      <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white px-6 py-12 text-center">
        <div className="text-sm font-bold text-zinc-900 mb-2">近日ご用意します</div>
        <div className="text-xs text-zinc-500 leading-relaxed">
          パスワードの変更などをこの画面から行えるようにする予定です。<br />
          それまでに変更が必要なときは、きよむさんにご相談ください。
        </div>
      </div>
    </div>
  );
}
