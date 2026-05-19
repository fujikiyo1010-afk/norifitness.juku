import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 認証なしでアクセス可能なパス(プレフィックスマッチ)
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/invite",
  "/debug", // Phase 1 用、本番では削除予定
  "/api",   // API は各エンドポイントで個別に認証
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // 未ログインで保護ページにアクセス → /login にリダイレクト
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // ログイン後の戻り先を query に保持(例: /login?next=/dashboard)
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + search);
    } else {
      loginUrl.searchParams.delete("next");
    }
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みで /login にアクセス → ホームへ
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除く全リクエストでミドルウェアを実行:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     * - 画像ファイル (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
