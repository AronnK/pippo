import type { SQLiteDatabase } from 'expo-sqlite';

import { localDate } from '@/database/queries/study';
import type { Streak } from '@/database/types';

const EMPTY_STREAK: Streak = { current_streak: 0, longest_streak: 0, last_completed_date: null, freeze_count: 0, last_awarded_milestone: 0, last_celebrated_milestone: 0, pending_freeze_decision: 0, is_dead: 0 };

function dateOffset(days: number, from = new Date()) {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return localDate(result);
}

export async function getStreak(db: SQLiteDatabase) {
  const streak = await db.getFirstAsync<Streak>('SELECT current_streak, longest_streak, last_completed_date, freeze_count, last_awarded_milestone, last_celebrated_milestone, pending_freeze_decision, is_dead FROM streak WHERE id = 1');
  return streak ?? EMPTY_STREAK;
}

export async function reconcileMissedDays(db: SQLiteDatabase) {
  const streak = await getStreak(db);
  if (!streak.last_completed_date || streak.last_completed_date >= dateOffset(-1) || streak.pending_freeze_decision || streak.is_dead) return streak;

  const oneDayMissed = streak.last_completed_date === dateOffset(-2);
  if (oneDayMissed && streak.freeze_count > 0) {
    await db.runAsync('UPDATE streak SET pending_freeze_decision = 1 WHERE id = 1');
  } else {
    await db.runAsync('UPDATE streak SET current_streak = 0, pending_freeze_decision = 0, is_dead = 1 WHERE id = 1');
  }
  return getStreak(db);
}

export async function resolveFreezeDecision(db: SQLiteDatabase, useFreeze: boolean) {
  const streak = await getStreak(db);
  if (!streak.pending_freeze_decision) return streak;
  if (useFreeze && streak.freeze_count > 0) {
    await db.runAsync('UPDATE streak SET freeze_count = freeze_count - 1, pending_freeze_decision = 0, last_completed_date = ?, is_dead = 0 WHERE id = 1', dateOffset(-1));
  } else {
    await db.runAsync('UPDATE streak SET current_streak = 0, pending_freeze_decision = 0, is_dead = 1 WHERE id = 1');
  }
  return getStreak(db);
}

export async function completeTodayIfEligible(db: SQLiteDatabase) {
  const today = localDate();
  const stats = await db.getFirstAsync<{ items_completed: number }>('SELECT items_completed FROM daily_stats WHERE date = ?', today);
  if (!stats || stats.items_completed < 50) return { streak: await getStreak(db), awardedMilestone: 0 };

  const reconciled = await reconcileMissedDays(db);
  if (reconciled.pending_freeze_decision) return { streak: reconciled, awardedMilestone: 0 };
  const streak = await getStreak(db);
  if (streak.last_completed_date === today) return { streak, awardedMilestone: 0 };

  const priorDay = dateOffset(-1);
  const current = streak.last_completed_date === priorDay ? streak.current_streak + 1 : 1;
  const longest = Math.max(streak.longest_streak, current);
  const milestone = current % 7 === 0 && current > streak.last_awarded_milestone ? current : 0;
  await db.runAsync(
    `UPDATE streak SET current_streak = ?, longest_streak = ?, last_completed_date = ?, is_dead = 0,
      freeze_count = freeze_count + ?, last_awarded_milestone = CASE WHEN ? > 0 THEN ? ELSE last_awarded_milestone END WHERE id = 1`,
    current, longest, today, milestone ? 1 : 0, milestone, milestone,
  );
  return { streak: await getStreak(db), awardedMilestone: milestone };
}

export async function consumeUnseenMilestone(db: SQLiteDatabase) {
  const streak = await getStreak(db);
  if (streak.current_streak > 0 && streak.current_streak % 7 === 0 && streak.last_awarded_milestone === streak.current_streak && streak.last_celebrated_milestone < streak.current_streak) {
    await db.runAsync('UPDATE streak SET last_celebrated_milestone = ? WHERE id = 1', streak.current_streak);
    return streak.current_streak;
  }
  return 0;
}
