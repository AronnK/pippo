export type Subject = { id: number; name: string; created_at: string };
export type Deck = { id: number; subject_id: number; name: string; created_at: string };
export type DeckSummary = Deck & { subject_name: string; items: number };
export type Flashcard = { id: number; deck_id: number; question: string; answer: string };
export type Mcq = {
  id: number;
  deck_id: number;
  question: string;
  options_json: string;
  correct_answer_index: number;
  explanation: string;
};
export type DailyStats = {
  date: string;
  items_completed: number;
  flashcards_completed: number;
  mcqs_completed: number;
  study_seconds: number;
};

export type Streak = {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  freeze_count: number;
  last_awarded_milestone: number;
  last_celebrated_milestone: number;
  pending_freeze_decision: number;
  is_dead: number;
};

export type NotificationCategory = 'hydration' | 'sleep' | 'study' | 'miss_you' | 'laundry' | 'keep_calm' | 'weak_review';
export type NotificationSetting = { category: NotificationCategory; is_enabled: number };
export type NotificationConfig = {
  quiet_hours_enabled: number;
  quiet_start_minute: number;
  quiet_end_minute: number;
};
export type QuietHours = { startMinute: number; endMinute: number; enabled: boolean };
export type LaundryReminder = { is_active: number; started_at: string | null; honor_quiet_hours: number };
type StudyItemBase = { id: number; deck_id: number; subject_id: number; last_seen_at: string | null };
export type StudyItem =
  | (StudyItemBase & { kind: 'flashcard'; question: string; answer: string })
  | (StudyItemBase & { kind: 'mcq'; question: string; options_json: string; correct_answer_index: number; explanation: string });
export type StudyScope = { subjectId?: number; deckId?: number };
