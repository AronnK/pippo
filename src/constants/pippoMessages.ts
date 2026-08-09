import type { PippoState } from "@/services/pippoState";

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

export const NOTIFICATION_MESSAGES = {
  hydration: [
    "Drink some water 💧",
    "Pippo hydration check 💧",
    "Go drink some water!",
    "Your body called. It wants water.",
  ],
  sleep: [
    "It’s getting late. Go sleep 🥱",
    "Pippo thinks you should sleep.",
    "Okay seriously, phone down. Sleep.",
    "Goodnight ❤️",
  ],
  study: [
    "Put the phone down. Go study. 👀",
    "Pippo thinks you should study now.",
    "You’ve got studying to do.",
    "Less scrolling. More studying.",
  ],
  miss_you: [
    "Someone misses you ❤️",
    "Pippo has something to tell you...",
    "Just wanted to say: ❤️",
    "You are missed.",
  ],
  laundry: [
    "Your clothes are soaking 🧺",
    "Go wash those clothes!",
    "Pippo reminder: THE LAUNDRY.",
    "You soaked them. Now actually wash them 😭",
    "Your clothes are still waiting.",
  ],
  keep_calm: [
    "Keep Calm ❤️",
    "You’re doing so great.",
    "You’re stronger than you think.",
    "You’re doing better than you realize.",
    "Keep going, Dr. Puttus ❤️",
    "One day at a time.",
  ],
} as const;
