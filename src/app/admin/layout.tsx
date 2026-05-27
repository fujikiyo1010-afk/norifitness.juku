import type { ReactNode } from "react";
import { UploadJobProvider } from "@/lib/upload/UploadJobContext";
import { UploadIndicator } from "@/components/UploadIndicator";

/**
 * 管理画面共通レイアウト。
 * - UploadJobProvider: 月次添削動画のバックグラウンドアップロード状態管理
 * - UploadIndicator: 右下フローティング表示 (送信中/完了/失敗)
 *
 * このレイアウトは /admin/* 以下のページにだけ適用される。
 * 受講生側のページ (/monthly-review/* など) には影響しない。
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <UploadJobProvider>
      {children}
      <UploadIndicator />
    </UploadJobProvider>
  );
}
