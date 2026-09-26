import type { SQLiteDatabase } from 'expo-sqlite';

import type { StudyItem, StudyScope } from '@/database/types';

const now = () => new Date().toISOString();

type Kind = 'flashcard' | 'mcq';

// Each item carries the subject it belongs to so selection can spread a session
// across subjects instead of draining one deck.
const COLUMNS: Record<Kind, string> = {
  flashcard:
    'cards.id, cards.question, cards.answer, cards.deck_id, decks.subject_id, cards.last_seen_at',
  mcq:
    'mcqs.id, mcqs.question, mcqs.options_json, mcqs.correct_answer_index, mcqs.explanation, mcqs.deck_id, decks.subject_id, mcqs.last_seen_at',
};

function scopeWhere(scope: StudyScope, table: string) {
  const clauses: string[] = [];
  const params: number[] = [];
  if (scope.deckId !== undefined) {
    clauses.push(`${table}.deck_id = ?`);
    params.push(scope.deckId);
  }
  if (scope.subjectId !== undefined) {
    clauses.push('decks.subject_id = ?');
    params.push(scope.subjectId);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function rowsOf(
  db: SQLiteDatabase,
  kind: Kind,
  scope: StudyScope,
  extraJoin = '',
  orderBy = '',
) {
  const table = kind === 'flashcard' ? 'cards' : 'mcqs';
  const { where, params } = scopeWhere(scope, table);
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT ${COLUMNS[kind]} FROM ${table} JOIN decks ON decks.id = ${table}.deck_id ${extraJoin} ${where} ${orderBy}`,
    ...params,
  );
}

async function allItems(db: SQLiteDatabase, scope: StudyScope = {}): Promise<StudyItem[]> {
  const cards = await rowsOf(db, 'flashcard', scope);
  const mcqs = await rowsOf(db, 'mcq', scope);
  return [
    ...cards.map((item) => ({ ...item, kind: 'flashcard' }) as StudyItem),
    ...mcqs.map((item) => ({ ...item, kind: 'mcq' }) as StudyItem),
  ];
}

export async function markFlashcard(db: SQLiteDatabase, cardId: number, knewIt: boolean) {
  await db.runAsync('UPDATE cards SET last_seen_at = ? WHERE id = ?', now(), cardId);
  if (knewIt) await db.runAsync('DELETE FROM weak_cards WHERE card_id = ?', cardId);
  else await db.runAsync('INSERT OR IGNORE INTO weak_cards (card_id, marked_at) VALUES (?, ?)', cardId, now());
}

export async function markMcq(db: SQLiteDatabase, mcqId: number, correct: boolean) {
  await db.runAsync('UPDATE mcqs SET last_seen_at = ? WHERE id = ?', now(), mcqId);
  if (correct) await db.runAsync('DELETE FROM weak_mcqs WHERE mcq_id = ?', mcqId);
  else await db.runAsync('INSERT OR IGNORE INTO weak_mcqs (mcq_id, marked_at) VALUES (?, ?)', mcqId, now());
}

export async function getWeakCounts(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ cards: number; mcqs: number }>(
    'SELECT (SELECT COUNT(*) FROM weak_cards) AS cards, (SELECT COUNT(*) FROM weak_mcqs) AS mcqs',
  );
  return row ?? { cards: 0, mcqs: 0 };
}

export async function getWeakItems(db: SQLiteDatabase, scope: StudyScope = {}): Promise<StudyItem[]> {
  const join = { flashcard: 'JOIN weak_cards ON weak_cards.card_id = cards.id', mcq: 'JOIN weak_mcqs ON weak_mcqs.mcq_id = mcqs.id' };
  const order = { flashcard: 'ORDER BY weak_cards.marked_at', mcq: 'ORDER BY weak_mcqs.marked_at' };
  const cards = await rowsOf(db, 'flashcard', scope, join.flashcard, order.flashcard);
  const mcqs = await rowsOf(db, 'mcq', scope, join.mcq, order.mcq);
  return [
    ...cards.map((item) => ({ ...item, kind: 'flashcard' }) as StudyItem),
    ...mcqs.map((item) => ({ ...item, kind: 'mcq' }) as StudyItem),
  ];
}

function shuffled<T>(items: T[]) {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

export async function selectRandomItems(db: SQLiteDatabase, scope: StudyScope, count: number) {
  return shuffled(await allItems(db, scope)).slice(0, count);
}

const WEEK_MS = 7 * 86_400_000;

function staleness(item: StudyItem) {
  if (!item.last_seen_at) return 1;
  return Math.min(1, (Date.now() - new Date(item.last_seen_at).getTime()) / WEEK_MS);
}

// Spec 4.5: weak first, then things she has not seen for a while, spread across
// subjects. Weighted draw inside each subject queue, then take one from each
// queue in turn so the same subject never comes up twice in a row.
export async function selectSurpriseItems(db: SQLiteDatabase, count: number) {
  const weak = new Set((await getWeakItems(db)).map((item) => `${item.kind}:${item.id}`));
  const queues = new Map<number, { item: StudyItem; score: number }[]>();
  for (const item of await allItems(db)) {
    const score =
      (weak.has(`${item.kind}:${item.id}`) ? 6 : 0) + staleness(item) * 3 + Math.random();
    const queue = queues.get(item.subject_id) ?? [];
    queue.push({ item, score });
    queues.set(item.subject_id, queue);
  }
  for (const queue of queues.values()) queue.sort((a, b) => b.score - a.score);

  const picked: StudyItem[] = [];
  let live = [...queues.values()];
  while (live.length && picked.length < count) {
    for (const queue of live) {
      const next = queue.shift();
      if (next) picked.push(next.item);
      if (picked.length >= count) break;
    }
    live = live.filter((queue) => queue.length);
  }
  return picked;
}
