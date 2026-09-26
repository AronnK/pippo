import { localDate } from "@/database/queries/study";
import type { SQLiteDatabase } from "expo-sqlite";

export type Interval = { start: number; end: number };

// Spec 4.7: a study screen nobody touches for this long stops counting time.
export const IDLE_TIMEOUT_MS = 150_000;

const secondsOf = (intervals: Interval[]) =>
  mergeIntervals(intervals).reduce(
    (sum, item) => sum + Math.round((item.end - item.start) / 1000),
    0,
  );

export function dayStart(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function shiftDate(date: string, days: number) {
  const result = new Date(dayStart(date));
  result.setDate(result.getDate() + days);
  return localDate(result);
}

// A week is the Monday-to-Sunday block a date falls in.
export function weekStart(date: string) {
  const weekday = new Date(dayStart(date)).getDay();
  return shiftDate(date, weekday === 0 ? -6 : 1 - weekday);
}

export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

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
  const open = await db.getFirstAsync<{
    id: number;
    subject_id: number | null;
    deck_id: number | null;
  }>(
    "SELECT id, subject_id, deck_id FROM study_sessions WHERE source = ? AND end_time IS NULL",
    source,
  );
  if (open) {
    if (open.subject_id === (subjectId ?? null) && open.deck_id === (deckId ?? null))
      return;
    // She moved to another deck mid-session: end the previous interval here so
    // each subject's time stays its own (spec 3 keeps subject_id/deck_id for this).
    await db.runAsync(
      "UPDATE study_sessions SET end_time = ? WHERE id = ?",
      new Date().toISOString(),
      open.id,
    );
  }
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
type SessionRow = {
  start_time: string;
  end_time: string;
  subject: string | null;
};

// Every finished interval, tagged with the subject it belongs to when the
// screen knew one. Manual timer rows stay untagged on purpose.
async function closedSessions(db: SQLiteDatabase) {
  return db.getAllAsync<SessionRow>(
    `SELECT study_sessions.start_time, study_sessions.end_time,
            COALESCE(by_subject.name, by_deck.name) AS subject
     FROM study_sessions
     LEFT JOIN decks ON decks.id = study_sessions.deck_id
     LEFT JOIN subjects AS by_subject ON by_subject.id = study_sessions.subject_id
     LEFT JOIN subjects AS by_deck ON by_deck.id = decks.subject_id
     WHERE study_sessions.end_time IS NOT NULL`,
  );
}

const partsOf = (row: SessionRow) =>
  splitIntervalByLocalDay({
    start: new Date(row.start_time).getTime(),
    end: new Date(row.end_time).getTime(),
  });

export async function rebuildStudySeconds(db: SQLiteDatabase) {
  const perDay = new Map<string, Interval[]>();
  for (const row of await closedSessions(db))
    for (const part of partsOf(row)) {
      const list = perDay.get(part.date) ?? [];
      list.push({ start: part.start, end: part.end });
      perDay.set(part.date, list);
    }
  for (const [date, intervals] of perDay)
    await db.runAsync(
      "INSERT INTO daily_stats (date, items_completed, flashcards_completed, mcqs_completed, study_seconds) VALUES (?,0,0,0,?) ON CONFLICT(date) DO UPDATE SET study_seconds = excluded.study_seconds",
      date,
      secondsOf(intervals),
    );
}
export async function studyTimeSummary(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ date: string; study_seconds: number }>(
    "SELECT date, study_seconds FROM daily_stats ORDER BY date",
  );
  const today = localDate();
  const monthStart = `${today.slice(0, 8)}01`;
  const week = await dailySeries(db, weekStart(today), today);
  const total = rows.reduce((s, x) => s + x.study_seconds, 0);
  return {
    today: rows.find((x) => x.date === today)?.study_seconds ?? 0,
    week: week.reduce((sum, day) => sum + day.seconds, 0),
    month: rows
      .filter((x) => x.date >= monthStart)
      .reduce((s, x) => s + x.study_seconds, 0),
    total,
    days: rows,
  };
}

export type DaySummary = { date: string; seconds: number; items: number };

// Every calendar day in the range, including the ones she did not study, so
// graphs and streak pictures keep their shape.
export async function dailySeries(
  db: SQLiteDatabase,
  from: string,
  to: string,
): Promise<DaySummary[]> {
  const rows = await db.getAllAsync<{
    date: string;
    study_seconds: number;
    items_completed: number;
  }>("SELECT date, study_seconds, items_completed FROM daily_stats");
  const found = new Map(rows.map((row) => [row.date, row]));
  const days: DaySummary[] = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const row = found.get(date);
    days.push({
      date,
      seconds: row?.study_seconds ?? 0,
      items: row?.items_completed ?? 0,
    });
  }
  return days;
}

export type DayBreakdown = {
  seconds: number;
  items: number;
  flashcards: number;
  mcqs: number;
  subjects: { name: string; seconds: number }[];
};

// Spec 4.8: tapping a calendar day shows its time, its item counts, and how
// that time split across subjects.
export async function dayBreakdown(
  db: SQLiteDatabase,
  date: string,
): Promise<DayBreakdown> {
  const stats = await db.getFirstAsync<{
    items_completed: number;
    flashcards_completed: number;
    mcqs_completed: number;
  }>(
    "SELECT items_completed, flashcards_completed, mcqs_completed FROM daily_stats WHERE date = ?",
    date,
  );
  const everything: Interval[] = [];
  const perSubject = new Map<string, Interval[]>();
  for (const row of await closedSessions(db))
    for (const part of partsOf(row)) {
      if (part.date !== date) continue;
      const interval = { start: part.start, end: part.end };
      everything.push(interval);
      if (!row.subject) continue;
      const list = perSubject.get(row.subject) ?? [];
      list.push(interval);
      perSubject.set(row.subject, list);
    }
  return {
    seconds: secondsOf(everything),
    items: stats?.items_completed ?? 0,
    flashcards: stats?.flashcards_completed ?? 0,
    mcqs: stats?.mcqs_completed ?? 0,
    subjects: [...perSubject]
      .map(([name, list]) => ({ name, seconds: secondsOf(list) }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

export async function subjectStudyTime(db: SQLiteDatabase) {
  const perSubject = new Map<string, Interval[]>();
  for (const row of await closedSessions(db)) {
    if (!row.subject) continue;
    const list = perSubject.get(row.subject) ?? [];
    list.push({
      start: new Date(row.start_time).getTime(),
      end: new Date(row.end_time).getTime(),
    });
    perSubject.set(row.subject, list);
  }
  return [...perSubject]
    .map(([name, list]) => ({ name, seconds: secondsOf(list) }))
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

export type GrowthInsights = {
  longestDay: { date: string; seconds: number } | null;
  bestWeek: { start: string; seconds: number } | null;
  studiedDays: number;
  windowDays: number;
  thisWeek: number;
  lastWeek: number;
  change: number | null;
};

// Spec 4.8: the raw material for the growth sentences.
export async function growthInsights(
  db: SQLiteDatabase,
): Promise<GrowthInsights> {
  const rows = await db.getAllAsync<{ date: string; study_seconds: number }>(
    "SELECT date, study_seconds FROM daily_stats WHERE study_seconds > 0",
  );
  const today = localDate();
  const weeks = new Map<string, number>();
  let longestDay: GrowthInsights["longestDay"] = null;
  for (const row of rows) {
    if (!longestDay || row.study_seconds > longestDay.seconds)
      longestDay = { date: row.date, seconds: row.study_seconds };
    const week = weekStart(row.date);
    weeks.set(week, (weeks.get(week) ?? 0) + row.study_seconds);
  }
  let bestWeek: GrowthInsights["bestWeek"] = null;
  for (const [start, seconds] of weeks)
    if (!bestWeek || seconds > bestWeek.seconds) bestWeek = { start, seconds };
  const windowStart = shiftDate(today, -29);
  const thisWeekStart = weekStart(today);
  return {
    longestDay,
    bestWeek,
    studiedDays: rows.filter((row) => row.date >= windowStart).length,
    windowDays: 30,
    thisWeek: weeks.get(thisWeekStart) ?? 0,
    lastWeek: weeks.get(shiftDate(thisWeekStart, -7)) ?? 0,
    change: percentChange(
      weeks.get(thisWeekStart) ?? 0,
      weeks.get(shiftDate(thisWeekStart, -7)) ?? 0,
    ),
  };
}
