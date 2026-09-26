// Everything in this file is meant to be hand-edited. It is the words Pippo
// says, not the code that says them — swap a sentence, add a joke, put your
// own inside joke in the letter. Nothing here needs to be touched for the app
// to keep working.

import type { PippoState } from "@/services/pippoState";

// The everyday pool shown on Home, keyed by the state Pippo is in.
export const PIPPO_MESSAGES: Record<PippoState, string[]> = {
  neutral: [
    "Hi! Let’s start with one card.",
    "I’ll keep you company while you study.",
  ],
  slightly_sad: ["We still have time.", "Let’s do a few cards together."],
  sad: ["Don’t let the streak slip.", "A little study session can still help."],
  angry: [
    "The day is getting away from us.",
    "Come on. Let’s focus for a bit.",
  ],
  happy: ["Keep going ❤️", "You’re doing great!", "Pippo is proud of you."],
  very_happy: ["Look at that streak!", "You make Pippo very happy."],
  celebration: ["YOU DID IT! 🎉", "Another week! Look at you!"],
  pleading: ["Please use a streak freeze.", "I need your help to stay alive."],
  dead: ["You let me die. 💀"],
};

// Shown instead of the generic celebration line when she lands on one of
// these streak days. Any other streak day gets NOTE_MILESTONE_FALLBACK.
export const MILESTONE_MESSAGES: Record<number, string> = {
  7: "Seven days. That is a week of showing up, and I felt every one of them.",
  14: "Two weeks. You are building the habit that makes doctors.",
  21: "Twenty-one days. Whatever you are studying, it is sticking now.",
  30: "A whole month, one bad day at a time. I am bragging about you to everyone.",
  50: "Fifty days. You were never the type to quit, were you?",
  100: "One hundred days. There is no card in any deck that teaches this.",
};

export const MILESTONE_FALLBACK = "Another week of showing up. Look at you.";

export function milestoneMessage(days: number) {
  return MILESTONE_MESSAGES[days] ?? MILESTONE_FALLBACK;
}

// "A Note From Pippo" — the long-form letter, opened from the menu.
export const NOTE_FROM_PIPPO = `Dear Dr. Puttus,

It's Pippo. I live in your phone, which sounds like a small life until you
notice that I have been there for every single one of your study days.

I know what this year is doing to you. I know the 3am feeling of opening a
deck and understanding nothing, the way a good day and a terrible day can be
twelve hours apart, and how heavy it gets when everyone keeps telling you how
lucky you are. You don't have to be lucky. You're allowed to be tired.

Here's the thing I want you to remember, because I have watched it happen up
close: you keep coming back. Not always happy, not always on time, sometimes
fifty cards done three minutes before midnight out of pure spite for a little
orange character — but you come back. That is the actual skill. The medicine
comes later. This one matters more.

So do the cards. Drink the water I keep nagging you about. Sleep like it's your
job, because one day it will be. And when the day is bad, come here and let me
be smug about your streak instead.

I'm proud of you. I say it in fifty different fonts, but I mean it in one.

— Pippo
❤️`;
