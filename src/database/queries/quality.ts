import type { SQLiteDatabase } from 'expo-sqlite';

import type { StudyItem } from '@/database/types';

const now = () => new Date().toISOString();
export async function markFlashcard(db: SQLiteDatabase, cardId: number, knewIt: boolean) { if (knewIt) await db.runAsync('DELETE FROM weak_cards WHERE card_id = ?', cardId); else await db.runAsync('INSERT OR IGNORE INTO weak_cards (card_id, marked_at) VALUES (?, ?)', cardId, now()); }
export async function markMcq(db: SQLiteDatabase, mcqId: number, correct: boolean) { if (correct) await db.runAsync('DELETE FROM weak_mcqs WHERE mcq_id = ?', mcqId); else await db.runAsync('INSERT OR IGNORE INTO weak_mcqs (mcq_id, marked_at) VALUES (?, ?)', mcqId, now()); }
export async function getWeakCounts(db: SQLiteDatabase) { const row = await db.getFirstAsync<{ cards: number; mcqs: number }>('SELECT (SELECT COUNT(*) FROM weak_cards) AS cards, (SELECT COUNT(*) FROM weak_mcqs) AS mcqs'); return row ?? { cards: 0, mcqs: 0 }; }
export async function getWeakItems(db: SQLiteDatabase): Promise<StudyItem[]> {
  const cards = await db.getAllAsync<{ id: number; question: string; answer: string }>('SELECT cards.id, cards.question, cards.answer FROM cards JOIN weak_cards ON weak_cards.card_id = cards.id ORDER BY weak_cards.marked_at');
  const mcqs = await db.getAllAsync<{ id: number; question: string; options_json: string; correct_answer_index: number; explanation: string }>('SELECT mcqs.id, mcqs.question, mcqs.options_json, mcqs.correct_answer_index, mcqs.explanation FROM mcqs JOIN weak_mcqs ON weak_mcqs.mcq_id = mcqs.id ORDER BY weak_mcqs.marked_at');
  return [...cards.map((item) => ({ ...item, kind: 'flashcard' as const })), ...mcqs.map((item) => ({ ...item, kind: 'mcq' as const }))];
}
async function allItems(db: SQLiteDatabase): Promise<StudyItem[]> {
  const cards = await db.getAllAsync<{ id: number; question: string; answer: string }>('SELECT id, question, answer FROM cards');
  const mcqs = await db.getAllAsync<{ id: number; question: string; options_json: string; correct_answer_index: number; explanation: string }>('SELECT id, question, options_json, correct_answer_index, explanation FROM mcqs');
  return [...cards.map((item) => ({ ...item, kind: 'flashcard' as const })), ...mcqs.map((item) => ({ ...item, kind: 'mcq' as const }))];
}
function shuffled<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5); }
export async function selectSurpriseItems(db: SQLiteDatabase, count: number, preferWeak = false) { const weak = await getWeakItems(db); const all = await allItems(db); const pool = preferWeak ? [...weak, ...all.filter((item) => !weak.some((weakItem) => weakItem.kind === item.kind && weakItem.id === item.id))] : shuffled(all); return (preferWeak ? pool : shuffled(pool)).slice(0, count); }
export async function selectRandomMcqs(db: SQLiteDatabase, count: number): Promise<StudyItem[]> { const all = await allItems(db); return shuffled(all.filter((item) => item.kind === 'mcq')).slice(0, count); }
