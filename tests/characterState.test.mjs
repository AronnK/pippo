import { check, finish } from "./harness.mjs";

const { getCharacterState } = await import("@/services/pippoState");
const { DAILY_GOAL } = await import("@/constants/goals");

const streak = (over = {}) => ({
  current_streak: 3,
  longest_streak: 9,
  last_completed_date: "2026-09-25",
  freeze_count: 1,
  last_awarded_milestone: 0,
  last_celebrated_milestone: 0,
  pending_freeze_decision: 0,
  is_dead: 0,
  ...over,
});

console.log("character states (spec 4.9)");

check(
  "a dead streak is the only thing that matters",
  getCharacterState(streak({ is_dead: 1 }), DAILY_GOAL, true, 12),
  "dead",
);
check(
  "waiting on a freeze decision looks like pleading",
  getCharacterState(streak({ pending_freeze_decision: 1 }), 0, false, 12),
  "pleading",
);
check(
  "a milestone is a celebration",
  getCharacterState(streak(), DAILY_GOAL, true, 12),
  "celebration",
);
check(
  "a brand new app with nothing done stays neutral",
  getCharacterState(streak({ last_completed_date: null }), 0, false, 9),
  "neutral",
);
check(
  "hitting the goal makes him happy",
  getCharacterState(streak(), DAILY_GOAL, false, 15),
  "happy",
);
check(
  "hitting the goal on a long streak makes him very happy",
  getCharacterState(streak({ current_streak: 7 }), DAILY_GOAL, false, 15),
  "very_happy",
);
check(
  "halfway there already reads as happy",
  getCharacterState(streak(), DAILY_GOAL / 2, false, 15),
  "happy",
);
check(
  "a streak at risk in the afternoon is sad, not angry",
  getCharacterState(streak(), 0, false, 15),
  "sad",
);
check(
  "a streak at risk with some work done softens to slightly sad",
  getCharacterState(streak(), 10, false, 15),
  "slightly_sad",
);
check(
  "a streak at risk late in the day turns angry",
  getCharacterState(streak(), 10, false, 20),
  "angry",
);
check(
  "no streak to lose stays neutral late at night",
  getCharacterState(streak({ current_streak: 0 }), 0, false, 22),
  "neutral",
);

finish();
