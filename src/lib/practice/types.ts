export type RealWorldActionRow = {
  id: string;
  user_id: string;
  lesson_id: string | null;
  planned_action: string;
  tried: boolean;
  tried_at: string | null;
  reflection: string | null;
  created_at: string;
  updated_at: string;
};

export type RealWorldActionWithContext = RealWorldActionRow & {
  lesson_title: string | null;
  chapter_title: string | null;
  course_title: string | null;
  chapter_id: string | null;
  course_id: string | null;
};
