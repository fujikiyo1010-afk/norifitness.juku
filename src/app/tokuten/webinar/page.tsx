import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { canSeeTokuten } from "@/lib/auth/tokuten-preview";
import { WEBINAR_TOKUTEN, countItems } from "../data";
import { TokutenList } from "../TokutenList";

export const metadata = {
  title: "ウェビナー特典 | 筋肉塾",
};

/**
 * 特典ライブラリ / ウェビナー特典 一覧 (/tokuten/webinar)
 * 種類でグループ分けした特典カード。各カード → public/tokuten/<file>.html。
 */
export default async function WebinarTokutenPage() {
  if (!(await canSeeTokuten())) redirect("/");
  return (
    <>
      <MemberHeader title="ウェビナー特典" fallbackHref="/tokuten" />
      <main className="min-h-screen bg-[#f5efe3]">
        <div className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-4">
          <p className="mb-2 px-0.5 text-[11px] font-bold text-[#a99a80]">
            全 {countItems(WEBINAR_TOKUTEN)} 本
          </p>
          <TokutenList groups={WEBINAR_TOKUTEN} />
        </div>
      </main>
    </>
  );
}
