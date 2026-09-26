import { localDate } from "@/database/queries/study";
import type { SQLiteDatabase } from "expo-sqlite";

export type Interval = { start: number; end: number };

// Spec 4.7: a study screen nobody touches for this long stops counting time.
export const IDLE_TIMEOUT_MS = 150_000;

export function mergeIntervals(intervals: Interval[]) {
  const sorted = intervals
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const item of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && item.start <= previous.end)
      previous.end = Math.max(previous.end, item.end);
    else merged.push({ ...item });
  }
  return merged;
}
export function splitIntervalByLocalDay(interval: Interval) {
  const parts: { date: string; start: number; end: number }[] = [];
  let cursor = interval.start;
  while (cursor < interval.end) {
    const date = new Date(cursor);
    const midnight = new Date(date);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(interval.end, midnight.getTime());
    parts.push({ date: localDate(date), start: cursor, end });
    cursor = end;
  }
  return parts;
}
export async function startSession(
  db: SQLiteDatabase,
  source: string,
  subjectId?: number,
  deckId?: number,
) {
  const open = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM study_sessions WHERE source = ? AND end_time IS NULL",
    source,
  );
  if (!open)
    await db.runAsync(
      "INSERT INTO study_sessions (start_time, end_time, source, subject_id, deck_id) VALUES (?, NULL, ?, ?, ?)",
      new Date().toISOString(),
      source,
      subjectId ?? null,
      deckId ?? null,
    );
}
export async function stopSession(db: SQLiteDatabase, source: string) {
  await db.runAsync(
    "UPDATE study_sessions SET end_time = ? WHERE source = ? AND end_time IS NULL",
    new Date().toISOString(),
    source,
  );
  await rebuildStudySeconds(db);
}
export async function getManualTimer(db: SQLiteDatabase) {
  return db.getFirstAsync<{ id: number; start_time: string }>(
    "SELECT id, start_time FROM study_sessions WHERE source = 'manual' AND end_time IS NULL",
  );
}
export async function rebuildStudySeconds(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ start_time: string; end_time: string }>(
    "SELECT start_time, end_time FROM study_sessions WHERE end_time IS NOT NULL",
  );
  const perDay = new Map<string, Interval[]>();
  for (const row of rows)
    for (const part of splitIntervalByLocalDay({
      start: new Date(row.start_time).getTime(),
      end: new Date(row.end_time).getTime(),
    })) {
      const list = perDay.get(part.date) ?? [];
      list.push({ start: part.start, end: part.end });
      perDay.set(part.date, list);
    }
  for (const [date, intervals] of perDay) {
    const seconds = mergeIntervals(intervals).reduce(
      (sum, item) => sum + Math.round((item.end - item.start) / 1000),
      0,
    );
    await db.runAsync(
      "INSERT INTO daily_stats (date, items_completed, flashcards_completed, mcqs_completed, study_seconds) VALUES (?,0,0,0,?) ON CONFLICT(date) DO UPDATE SET study_seconds = excluded.study_seconds",
      date,
      seconds,
    );
  }
}
export async function studyTimeSummary(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ date: string; study_seconds: number }>(
    "SELECT date, study_seconds FROM daily_stats",
  );
  const today = localDate();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const weekStart = new Date(midnight);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(midnight.getFullYear(), midnight.getMonth(), 1);
  const total = rows.reduce((s, x) => s + x.study_seconds, 0);
  return {
    today: rows.find((x) => x.date === today)?.study_seconds ?? 0,
    week: rows
      .filter((x) => x.date >= localDate(weekStart))
      .reduce((s, x) => s + x.study_seconds, 0),
    month: rows
      .filter((x) => x.date >= localDate(monthStart))
      .reduce((s, x) => s + x.study_seconds, 0),
    total,
    days: rows,
  };
}
export async function subjectStudyTime(db: SQLiteDatabase) {
  return db.getAllAsync<{ name: string; seconds: number }>(
    `SELECT subjects.name, SUM((julianday(study_sessions.end_time)-julianday(study_sessions.start_time))*86400) AS seconds FROM study_sessions JOIN decks ON decks.id=study_sessions.deck_id JOIN subjects ON subjects.id=decks.subject_id WHERE study_sessions.end_time IS NOT NULL GROUP BY subjects.id HAVING seconds>0 ORDER BY seconds DESC`,
  );
}
