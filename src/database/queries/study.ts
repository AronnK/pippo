import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  DailyStats,
  Deck,
  DeckSummary,
  Flashcard,
  Mcq,
  Subject,
} from '@/database/types';

export function localDate(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' in the caller's own timezone, not UTC.
export function dayStart(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

export async function getSubjects(db: SQLiteDatabase) {
  return db.getAllAsync<Subject>('SELECT * FROM subjects ORDER BY name COLLATE NOCASE');
}

// Deleting a subject takes its decks, their cards and MCQs and every weak mark
// on them, because each child is ON DELETE CASCADE. The study_sessions they
// generated stay and lose their labels (SET NULL), so banked study time
// outlives the subject it was filed under.
export async function deleteSubject(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM subjects WHERE id = ?', id);
}

export async function getDecks(db: SQLiteDatabase, subjectId: number) {
  return db.getAllAsync<Deck>('SELECT * FROM decks WHERE subject_id = ? ORDER BY name COLLATE NOCASE', subjectId);
}

export async function getSubjectStats(db: SQLiteDatabase) {
  return db.getAllAsync<{
    id: number;
    name: string;
    decks: number;
    cards: number;
    mcqs: number;
    weak: number;
  }>(
    `SELECT s.id, s.name,
            (SELECT COUNT(*) FROM decks d WHERE d.subject_id = s.id) AS decks,
            (SELECT COUNT(*) FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.subject_id = s.id) AS cards,
            (SELECT COUNT(*) FROM mcqs m JOIN decks d ON d.id = m.deck_id WHERE d.subject_id = s.id) AS mcqs,
            (SELECT COUNT(*) FROM weak_cards w JOIN cards c ON c.id = w.card_id JOIN decks d ON d.id = c.deck_id WHERE d.subject_id = s.id) +
            (SELECT COUNT(*) FROM weak_mcqs w JOIN mcqs m ON m.id = w.mcq_id JOIN decks d ON d.id = m.deck_id WHERE d.subject_id = s.id) AS weak
     FROM subjects s
     ORDER BY s.name COLLATE NOCASE`,
  );
}

export async function getDecksWithCounts(db: SQLiteDatabase) {
  return db.getAllAsync<DeckSummary>(
    `SELECT d.id, d.subject_id, d.name, d.created_at, s.name AS subject_name,
            (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) +
            (SELECT COUNT(*) FROM mcqs m WHERE m.deck_id = d.id) AS items
     FROM decks d
     JOIN subjects s ON s.id = d.subject_id
     ORDER BY s.name COLLATE NOCASE, d.name COLLATE NOCASE`,
  );
}

export async function getFlashcards(db: SQLiteDatabase, deckId: number) {
  return db.getAllAsync<Flashcard>('SELECT id, deck_id, question, answer FROM cards WHERE deck_id = ? ORDER BY id', deckId);
}

export async function getMcqs(db: SQLiteDatabase, deckId: number) {
  return db.getAllAsync<Mcq>(
    'SELECT id, deck_id, question, options_json, correct_answer_index, explanation FROM mcqs WHERE deck_id = ? ORDER BY id',
    deckId,
  );
}

export async function getTodayStats(db: SQLiteDatabase) {
  const date = localDate();
  const stats = await db.getFirstAsync<DailyStats>('SELECT * FROM daily_stats WHERE date = ?', date);
  return stats ?? { date, items_completed: 0, flashcards_completed: 0, mcqs_completed: 0, study_seconds: 0 };
}

export async function recordCompletedItem(db: SQLiteDatabase, type: 'flashcard' | 'mcq') {
  const date = localDate();
  const flashcards = type === 'flashcard' ? 1 : 0;
  const mcqs = type === 'mcq' ? 1 : 0;
  await db.runAsync(
    `INSERT INTO daily_stats (date, items_completed, flashcards_completed, mcqs_completed, study_seconds)
     VALUES (?, 1, ?, ?, 0)
     ON CONFLICT(date) DO UPDATE SET
       items_completed = items_completed + 1,
       flashcards_completed = flashcards_completed + excluded.flashcards_completed,
       mcqs_completed = mcqs_completed + excluded.mcqs_completed`,
    date,
    flashcards,
    mcqs,
  );
}
