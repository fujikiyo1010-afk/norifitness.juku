import { NextResponse } from "next/server";
import { hasUnreadSupportReply } from "@/lib/support/queries";

export const dynamic = "force-dynamic";

/**
 * お問い合わせの未読有無 (2026-08-28)
 * 下部ナビ(クライアント)がプロフィールタブの赤ドットを出すために叩く。
 * 未ログイン/失敗は unread:false(無印なだけ・エラーにしない)。
 */
export async function GET() {
  try {
    const unread = await hasUnreadSupportReply();
    return NextResponse.json({ unread });
  } catch {
    return NextResponse.json({ unread: false });
  }
}
