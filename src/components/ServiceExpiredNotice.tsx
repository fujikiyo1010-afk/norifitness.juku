import Link from "next/link";

/**
 * サービス満了ユーザーが閉鎖機能(月次/フォーム添削/カルテ更新/目標シート)を
 * 開いた時のご案内 (2026-08-14)。トーンは責めない・LINE相談へ誘導。
 */
export function ServiceExpiredNotice({ title }: { title: string }) {
  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed]">
      <div className="mx-auto max-w-[460px] px-4 py-12">
        <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-8 text-center">
          <div className="text-[14px] font-bold text-[#2b2620] mb-3">{title}</div>
          <p className="text-[12.5px] leading-relaxed text-[#6a6256]">
            サポート期間が満了しているため、
            <br />
            こちらの機能はご利用いただけません。
            <br />
            <br />
            ご相談は、これまで通り
            <br />
            LINEでいつでも受け付けています。
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border-2 border-[#4a875b] px-6 py-2.5 text-[12px] font-extrabold text-[#34603f]"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
