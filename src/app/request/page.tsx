import Link from "next/link";
import { RequestForm } from "./RequestForm";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ submitted?: string }>;

export default async function RequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { submitted } = await searchParams;

  if (submitted === "1") {
    return <RequestComplete />;
  }

  return (
    <>
      <MemberHeader title="入会申請" fallbackHref="/" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <div
          className="flex-1 px-6 py-7"
          style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
        >
          <div className="text-center mb-6">
            <div className="w-[60px] h-[60px] mx-auto mb-3 rounded-2xl flex items-center justify-center bg-[#4a875b]/8">
              <DocIcon />
            </div>
            <h2 className="text-lg font-bold text-[#004d40] mb-1.5">
              筋肉塾へようこそ
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              お振込ありがとうございました。
              <br />
              以下の情報を入力してください
            </p>
          </div>

          <RequestForm />

          <div className="mt-3.5 bg-[#4a875b]/[0.06] border-l-[3px] border-[#4a875b] rounded-sm px-3 py-2.5 text-[11px] text-zinc-700 leading-relaxed">
            申請後、 のりfitness が内容を確認 (通常 1 営業日以内)、 確認完了後にメールでアカウント有効化リンクをお送りします。
          </div>

          <div className="mt-3 text-center text-[10.5px] text-[#6a6256] leading-relaxed">
            個別面談がお済みでない方は、 まず{" "}
            <span className="text-[#34603f] font-medium">公式 LINE</span>
            までご連絡ください。
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

function RequestComplete() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <header className="px-4 py-3 border-b border-[#e7dcc9] text-center">
          <h1 className="text-[15px] font-bold text-[#2b2620]">申請完了</h1>
        </header>

        <div
          className="flex-1 px-6 py-10 flex flex-col items-center justify-center text-center"
          style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
        >
          <div className="w-[80px] h-[80px] mb-5 rounded-full bg-[#4a875b]/10 flex items-center justify-center">
            <CheckIcon />
          </div>
          <h2 className="text-xl font-bold text-[#004d40] mb-2">
            申請を受け付けました
          </h2>
          <p className="text-sm text-zinc-700 leading-relaxed mb-6">
            のりfitness が内容を確認し、
            <br />
            通常 1 営業日以内にアカウント有効化リンクを
            <br />
            メールでお送りします。
          </p>
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-lg px-4 py-3 text-xs text-zinc-600 leading-relaxed">
            メールが届かない場合は、 迷惑メールフォルダを
            <br />
            ご確認のうえ、 公式 LINE までご連絡ください。
          </div>

          <Link
            href="/login"
            className="mt-8 text-xs text-[#34603f] underline hover:text-[#004d40]"
          >
            ログイン画面へ
          </Link>
        </div>
      </div>
    </main>
  );
}

function DocIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#004d40"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4a875b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
