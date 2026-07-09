import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { createClient } from "@/lib/supabase/server";
import { listMyBodyPhotosForGallery } from "@/lib/body-photos/queries";
import { PhotoGallery } from "./PhotoGallery";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ 体型写真ギャラリー (/record/photos) ・ 2026-07-06 P6 再設計
 *
 * モック: scratchpad/photo_gallery_mock_v2.html 「案A改 ・ 月セレクタ＋アコーディオン」
 *   - 記録画面(/record)はビフォーアフター2枚だけ。全履歴はこの別ページで。
 *   - 月チップで切替 + 月アコーディオン(最新月のみ展開)。
 *   - 一覧はサムネのみ、開いた月だけ画像を読み込む(毎日30枚でも軽い)。
 */
export default async function BodyPhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/record/photos");

  const photos = await listMyBodyPhotosForGallery();

  return (
    <>
      <MemberHeader title="体型写真の記録" fallbackHref="/record" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px]">
          <PhotoGallery photos={photos} userId={user.id} />
        </div>
      </main>
    </>
  );
}
