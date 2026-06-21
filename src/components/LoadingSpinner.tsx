/**
 * 共通 ローディングスピナー (= ボタン内 / 小さな表示用)
 *
 * 用途:
 *   - Server Action 実行中の送信ボタン内
 *   - データ取得中の小さなインジケータ
 *
 * 仕様:
 *   - currentColor で親要素の text-color を継承 (= ボタン背景に合わせて自動調整)
 *   - サイズは props で指定可能 (= デフォルト 12px / inline-block)
 *   - SSR セーフ (= no js fallback でも回転だけは見える)
 */
export function LoadingSpinner({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block align-text-bottom animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
