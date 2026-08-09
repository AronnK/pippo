import type { SQLiteDatabase } from 'expo-sqlite';

type FlashcardInput = { question: string; answer: string };
type McqInput = { question: string; options: [string, string, string, string]; correctIndex: number; explanation: string };
export type ImportKind = 'flashcards' | 'mcqs';
export type ImportPreview = { kind: ImportKind; subject: string; items: FlashcardInput[] | McqInput[] };

function cleanText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}

function extractJson(input: string) {
  const stripped = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = stripped.search(/[\[{]/);
  if (start === -1) throw new Error('No JSON object was found. Paste the NotebookLM JSON response.');
  for (let end = stripped.length; end > start; end -= 1) {
    try {
      return JSON.parse(stripped.slice(start, end));
    } catch {
      // Try a shorter trailing slice until the embedded JSON object parses.
    }
  }
  throw new Error('That does not appear to be valid JSON. Check for missing quotes or commas.');
}

export function validateNotebookLmJson(raw: string, kind: ImportKind): ImportPreview {
  const parsed: unknown = extractJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected one JSON object.');
  const data = parsed as Record<string, unknown>;
  const subject = cleanText(data.subject, 'Subject');
  const collectionKey = kind === 'flashcards' ? 'flashcards' : 'questions';
  const collection = data[collectionKey];
  if (!Array.isArray(collection) || collection.length === 0) throw new Error(`Expected at least one ${collectionKey} entry.`);

  if (kind === 'flashcards') {
    const items = collection.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`Flashcard ${index + 1} must be an object.`);
      const card = item as Record<string, unknown>;
      return { question: cleanText(card.question, `Flashcard ${index + 1} question`), answer: cleanText(card.answer, `Flashcard ${index + 1} answer`) };
    });
    return { kind, subject, items };
  }

  const items = collection.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`MCQ ${index + 1} must be an object.`);
    const question = item as Record<string, unknown>;
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`MCQ ${index + 1} must have exactly four options.`);
    const options = question.options.map((option, optionIndex) => cleanText(option, `MCQ ${index + 1} option ${optionIndex + 1}`)) as McqInput['options'];
    if (!Number.isInteger(question.correctIndex) || (question.correctIndex as number) < 0 || (question.correctIndex as number) > 3) throw new Error(`MCQ ${index + 1} correctIndex must be 0, 1, 2, or 3.`);
    return { question: cleanText(question.question, `MCQ ${index + 1} question`), options, correctIndex: question.correctIndex as number, explanation: cleanText(question.explanation, `MCQ ${index + 1} explanation`) };
  });
  return { kind, subject, items };
}

export async function importPreview(db: SQLiteDatabase, preview: ImportPreview, subjectName: string, deckName: string) {
  const subject = cleanText(subjectName, 'Subject name');
  const deck = cleanText(deckName, 'Deck name');
  const timestamp = new Date().toISOString();
  let subjectId = 0;
  let deckId = 0;

  await db.withExclusiveTransactionAsync(async (tx) => {
    const existingSubject = await tx.getFirstAsync<{ id: number }>('SELECT id FROM subjects WHERE name = ? COLLATE NOCASE', subject);
    if (existingSubject) subjectId = existingSubject.id;
    else subjectId = Number((await tx.runAsync('INSERT INTO subjects (name, created_at) VALUES (?, ?)', subject, timestamp)).lastInsertRowId);

    const existingDeck = await tx.getFirstAsync<{ id: number }>('SELECT id FROM decks WHERE subject_id = ? AND name = ? COLLATE NOCASE', subjectId, deck);
    if (existingDeck) deckId = existingDeck.id;
    else deckId = Number((await tx.runAsync('INSERT INTO decks (subject_id, name, created_at) VALUES (?, ?, ?)', subjectId, deck, timestamp)).lastInsertRowId);

    if (preview.kind === 'flashcards') {
      for (const item of preview.items as FlashcardInput[]) await tx.runAsync('INSERT INTO cards (deck_id, question, answer, created_at) VALUES (?, ?, ?, ?)', deckId, item.question, item.answer, timestamp);
    } else {
      for (const item of preview.items as McqInput[]) await tx.runAsync('INSERT INTO mcqs (deck_id, question, options_json, correct_answer_index, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?)', deckId, item.question, JSON.stringify(item.options), item.correctIndex, item.explanation, timestamp);
    }
    await tx.runAsync('INSERT INTO import_history (imported_at, subject, deck, card_count) VALUES (?, ?, ?, ?)', timestamp, subject, deck, preview.items.length);
  });
  return { subjectId, deckId, count: preview.items.length };
}
