import type { Streak } from "@/database/types";

export type PippoState =
  | "neutral"
  | "slightly_sad"
  | "sad"
  | "angry"
  | "happy"
  | "very_happy"
  | "celebration"
  | "pleading"
  | "dead";

export function getCharacterState(
  streak: Streak,
  todayProgress: number,
  isCelebrating = false,
): PippoState {
  if (streak.is_dead) return "dead";
  if (streak.pending_freeze_decision) return "pleading";
  if (isCelebrating) return "celebration";
  if (!streak.last_completed_date && todayProgress === 0) return "neutral";
  if (todayProgress >= 50)
    return streak.current_streak >= 7 ? "very_happy" : "happy";
  if (todayProgress >= 25) return "happy";
  if (streak.current_streak > 0)
    return todayProgress > 0 ? "slightly_sad" : "sad";
  return todayProgress > 0 ? "slightly_sad" : "neutral";
}
