export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          🎓 筋肉塾
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          のりfitness 筋肉塾の受講生専用 学習プラットフォーム
        </p>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-left text-sm">
          <h2 className="font-semibold mb-3 text-zinc-900 dark:text-zinc-50">
            🚧 フェーズ1 着手中
          </h2>
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>✅ Next.js 16 + TypeScript + Tailwind CSS</li>
            <li>✅ Supabase クライアント設定</li>
            <li>⏳ 認証フロー実装中</li>
            <li>⏳ Supabase テーブル作成</li>
            <li>⏳ デプロイ準備</li>
          </ul>
        </div>
        <p className="text-xs text-zinc-500">
          開発中: 公開予定 2026年8月末
        </p>
      </div>
    </main>
  );
}

