import type { NotificationCategory } from "@/database/types";
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

export const NOTIFICATION_MESSAGES: Record<NotificationCategory, readonly string[]> = {
  hydration: [
    "Drink some water 💧",
    "Pippo hydration check 💧",
    "Go drink some water!",
    "Your body called. It wants water.",
    "You’ve read a hundred pages today. Drink something.",
    "Water first. Then the next card.",
    "Hydrate, or your kidneys will file a complaint.",
  ],
  // sleep is read in order, not picked randomly: it gets more direct as the night goes on.
  sleep: [
    "It’s getting late. Wrap up 🥱",
    "Twenty more minutes, then the phone goes down.",
    "Okay seriously, phone down. Sleep.",
    "Go to sleep. Tomorrow-you has rounds.",
  ],
  study: [
    "Put the phone down. Go study. 👀",
    "Pippo thinks you should study now.",
    "You’ve got studying to do.",
    "Less scrolling. More studying.",
    "It’s been a while. Where are the cards?",
    "Open the app. One deck, that’s all we need.",
  ],
  miss_you: [
    "Someone misses you ❤️",
    "Pippo has something to tell you...",
    "Just wanted to say: ❤️",
    "You are missed.",
    "No agenda. Just missing you.",
    "Pippo noticed you’ve been gone a while.",
  ],
  laundry: [
    "Your clothes are soaking 🧺",
    "Go wash those clothes!",
    "Pippo reminder: THE LAUNDRY.",
    "You soaked them. Now actually wash them 😭",
    "Your clothes are still waiting.",
    "They’re not going to wash themselves.",
    "Still soaking. Still not washed. 🧺",
  ],
  keep_calm: [
    "Keep Calm ❤️",
    "You’re doing so great.",
    "You’re stronger than you think.",
    "You’re doing better than you realize.",
    "Keep going, Dr. Puttus ❤️",
    "One day at a time.",
    "This is hard and you’re still here.",
  ],
  weak_review: [
    "The weak pile is waiting for you.",
    "You’ve got cards you keep missing. Let’s fix that.",
    "Time to review the ones that got away.",
    "Pippo wants to see your weak cards.",
    "A short weak-card run would feel good right now.",
    "Those mistakes are still on the list.",
  ],
};
