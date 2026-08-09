import type { SQLiteDatabase } from 'expo-sqlite';

import type { DailyStats, Deck, Flashcard, Mcq, Subject } from '@/database/types';

export function localDate(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

export async function getSubjects(db: SQLiteDatabase) {
  return db.getAllAsync<Subject>('SELECT * FROM subjects ORDER BY name COLLATE NOCASE');
}

export async function getDecks(db: SQLiteDatabase, subjectId: number) {
  return db.getAllAsync<Deck>('SELECT * FROM decks WHERE subject_id = ? ORDER BY name COLLATE NOCASE', subjectId);
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
