/**
 * Supabase データベース型定義
 *
 * フェーズ1 でマイグレーション SQL を適用した後、
 * `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
 * で自動生成される予定。
 *
 * 現状はプレースホルダー。
 */

export type Database = {
  public: {
    Tables: {
      // 例: users, lessons, comments 等のテーブル定義が自動生成される
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
