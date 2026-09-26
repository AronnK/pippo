import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import { Image, Platform } from "react-native";

import { DAILY_GOAL } from "@/constants/goals";
import { NOTIFICATION_MESSAGES } from "@/constants/pippoMessages";
import { getTodayStats } from "@/database/queries/study";
import type {
  LaundryReminder,
  NotificationCategory,
  NotificationConfig,
  NotificationSetting,
  QuietHours,
} from "@/database/types";

const CATEGORIES: NotificationCategory[] = [
  "hydration",
  "sleep",
  "study",
  "miss_you",
  "laundry",
  "keep_calm",
  "weak_review",
];
// Scheduled far in the future, so they are re-armed only once they have fired;
// rescheduling on every app open would push them out forever.
const RARE_CATEGORIES: NotificationCategory[] = [
  "miss_you",
  "keep_calm",
  "weak_review",
];
const DEFAULT_QUIET_START_MINUTE = 22 * 60 + 30;
const DEFAULT_QUIET_END_MINUTE = 7 * 60;
const STUDY_NUDGE_HOURS = 3;
const LAUNDRY_INTERVAL_MINUTES = 30;
const DAY_MS = 86_400_000;
const SLEEP_SLOTS: [number, number][] = [
  [22, 0],
  [22, 45],
  [23, 30],
  [0, 15],
];

const assets = {
  hydration: require("@/assets/pippo/hydrate.webp"),
  sleep: require("@/assets/pippo/sleep-1.webp"),
  study: require("@/assets/pippo/no-phone.webp"),
  miss_you: require("@/assets/pippo/miss-you-1.webp"),
  laundry: require("@/assets/pippo/laundry.webp"),
  keep_calm: require("@/assets/pippo/keep-calm.webp"),
  weak_review: require("@/assets/pippo/slightly-sad.webp"),
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function attachment(category: NotificationCategory) {
  const source = Image.resolveAssetSource(
    category === "sleep"
      ? pick([
          require("@/assets/pippo/sleep-1.webp"),
          require("@/assets/pippo/sleep-2.webp"),
        ])
      : category === "miss_you"
        ? pick([
            require("@/assets/pippo/miss-you-1.webp"),
            require("@/assets/pippo/miss-you-2.webp"),
            require("@/assets/pippo/miss-you-3.webp"),
            require("@/assets/pippo/miss-you-4.webp"),
          ])
        : assets[category],
  );
  return [{ identifier: category, url: source.uri, type: "public.webp" }];
}

function content(category: NotificationCategory, body?: string) {
  const images = attachment(category);
  return {
    title: category === "laundry" ? "Pippo laundry reminder" : "Pippo",
    body: body ?? pick(NOTIFICATION_MESSAGES[category]),
    data: { pippoCategory: category },
    sound: "default" as const,
    attachments: images,
  };
}

function dailyTrigger(
  hour: number,
  minute: number,
): Notifications.NotificationTriggerInput {
  if (Platform.OS === "android")
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    hour,
    minute,
  };
}

function intervalTrigger(
  minutes: number,
): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: minutes * 60,
    repeats: true,
  };
}

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isQuietAt(quiet: QuietHours, minute: number) {
  if (!quiet.enabled) return false;
  return quiet.startMinute > quiet.endMinute
    ? minute >= quiet.startMinute || minute < quiet.endMinute
    : minute >= quiet.startMinute && minute < quiet.endMinute;
}

// A DATE trigger inherits the current wall-clock time, so a reminder scheduled
// at 2am would still arrive at 2am days later without this push past quiet hours.
function nextWakingTime(quiet: QuietHours, date: Date) {
  const minute = minuteOfDay(date);
  if (!isQuietAt(quiet, minute)) return date;
  // A window that runs past midnight ends the day after it starts, but a date
  // already inside the early-morning half still wakes up the same day.
  if (quiet.startMinute > quiet.endMinute && minute >= quiet.startMinute)
    date.setDate(date.getDate() + 1);
  date.setHours(Math.floor(quiet.endMinute / 60), quiet.endMinute % 60, 0, 0);
  return date;
}

function dateTrigger(
  date: Date,
  quiet: QuietHours,
): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: nextWakingTime(quiet, date),
  };
}

// Minutes past midnight that fall inside the waking window, stepping every
// `step` minutes from the moment quiet hours end.
function wakingSlots(quiet: QuietHours, step: number) {
  const span = quiet.enabled
    ? (quiet.startMinute - quiet.endMinute + 1440) % 1440
    : 1440;
  const slots: number[] = [];
  for (let offset = 0; offset < span; offset += step)
    slots.push((quiet.endMinute + offset) % 1440);
  return slots;
}

export async function getQuietHours(db: SQLiteDatabase): Promise<QuietHours> {
  const row = await db.getFirstAsync<NotificationConfig>(
    "SELECT quiet_hours_enabled, quiet_start_minute, quiet_end_minute FROM notification_config WHERE id = 1",
  );
  return {
    enabled: (row?.quiet_hours_enabled ?? 1) === 1,
    startMinute: row?.quiet_start_minute ?? DEFAULT_QUIET_START_MINUTE,
    endMinute: row?.quiet_end_minute ?? DEFAULT_QUIET_END_MINUTE,
  };
}

export async function setQuietHours(
  db: SQLiteDatabase,
  quiet: QuietHours,
) {
  await db.runAsync(
    `INSERT INTO notification_config (id, quiet_hours_enabled, quiet_start_minute, quiet_end_minute)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       quiet_hours_enabled = excluded.quiet_hours_enabled,
       quiet_start_minute = excluded.quiet_start_minute,
       quiet_end_minute = excluded.quiet_end_minute`,
    quiet.enabled ? 1 : 0,
    quiet.startMinute,
    quiet.endMinute,
  );
  // Pending triggers may now sit inside the new window, so everything is re-armed.
  await cancelAllNotifications();
  await scheduleEnabledNotifications(db);
  return getQuietHours(db);
}

export async function ensureNotificationSettings(db: SQLiteDatabase) {
  for (const category of CATEGORIES)
    await db.runAsync(
      "INSERT OR IGNORE INTO notification_settings (category, is_enabled) VALUES (?, 1)",
      category,
    );
  return db.getAllAsync<NotificationSetting>(
    "SELECT category, is_enabled FROM notification_settings ORDER BY category",
  );
}

export async function getNotificationSettings(db: SQLiteDatabase) {
  return ensureNotificationSettings(db);
}

export async function setNotificationEnabled(
  db: SQLiteDatabase,
  category: NotificationCategory,
  enabled: boolean,
) {
  await db.runAsync(
    "INSERT INTO notification_settings (category, is_enabled) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET is_enabled = excluded.is_enabled",
    category,
    enabled ? 1 : 0,
  );
  if (enabled) await scheduleCategory(db, category);
  else await cancelCategory(category);
}

async function permissionGranted() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("pippo-reminders", {
      name: "Pippo reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function cancelCategory(category: NotificationCategory) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.content.data?.pippoCategory === category)
        .map((item) =>
          Notifications.cancelScheduledNotificationAsync(item.identifier),
        ),
    );
  } catch {
    // There may be no notification service available in an unsupported runtime.
  }
}

export async function cancelAllNotifications() {
  for (const category of CATEGORIES) await cancelCategory(category);
}

async function hasPendingCategory(category: NotificationCategory) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(
    (item) => item.content.data?.pippoCategory === category,
  );
}

function schedule(category: NotificationCategory, trigger: Notifications.NotificationTriggerInput, body?: string) {
  return Notifications.scheduleNotificationAsync({
    content: content(category, body),
    trigger,
  });
}

export async function scheduleCategory(
  db: SQLiteDatabase,
  category: NotificationCategory,
) {
  try {
    const setting = await db.getFirstAsync<NotificationSetting>(
      "SELECT category, is_enabled FROM notification_settings WHERE category = ?",
      category,
    );
    if (!setting?.is_enabled || !(await permissionGranted())) {
      await cancelCategory(category);
      return;
    }
    const quiet = await getQuietHours(db);
    if (RARE_CATEGORIES.includes(category) && (await hasPendingCategory(category)))
      return;
    await cancelCategory(category);
    if (category === "hydration") {
      for (const minute of wakingSlots(quiet, 120))
        await schedule(
          category,
          dailyTrigger(Math.floor(minute / 60), minute % 60),
        );
    } else if (category === "sleep") {
      // The sleep nag is the one category that pings through quiet hours, and
      // its messages are read in order so they get more direct as the night goes on.
      const ladder = NOTIFICATION_MESSAGES.sleep;
      for (const [index, [hour, minute]] of SLEEP_SLOTS.entries())
        await schedule(
          category,
          dailyTrigger(hour, minute),
          ladder[Math.min(index, ladder.length - 1)],
        );
    } else if (category === "study") {
      const today = await getTodayStats(db);
      if ((today?.items_completed ?? 0) >= DAILY_GOAL) return;
      await schedule(
        category,
        dateTrigger(
          new Date(Date.now() + STUDY_NUDGE_HOURS * 3_600_000),
          quiet,
        ),
      );
    } else if (category === "weak_review") {
      for (const days of [2, 4])
        await schedule(
          category,
          dateTrigger(new Date(Date.now() + days * DAY_MS), quiet),
        );
    } else if (category === "miss_you") {
      for (const days of [4, 9])
        await schedule(
          category,
          dateTrigger(new Date(Date.now() + days * DAY_MS), quiet),
        );
    } else if (category === "keep_calm") {
      let next = Date.now();
      for (let index = 0; index < 4; index += 1) {
        next += (Math.random() < 0.5 ? 3 : 4) * DAY_MS;
        await schedule(
          category,
          dateTrigger(new Date(next), quiet),
        );
      }
    } else {
      const laundry = await getLaundryReminder(db);
      if (!laundry.is_active) return;
      if (laundry.honor_quiet_hours && quiet.enabled) {
        // A repeating interval trigger cannot skip a window, so honoring quiet
        // hours means one daily reminder per laundry slot inside the day.
        for (const minute of wakingSlots(quiet, LAUNDRY_INTERVAL_MINUTES))
          await schedule(
            category,
            dailyTrigger(Math.floor(minute / 60), minute % 60),
          );
      } else await schedule(category, intervalTrigger(LAUNDRY_INTERVAL_MINUTES));
    }
  } catch {
    // Notification permissions and scheduling may be unavailable; the app must stay usable.
  }
}

export async function scheduleEnabledNotifications(db: SQLiteDatabase) {
  const settings = await ensureNotificationSettings(db);
  for (const setting of settings)
    if (setting.is_enabled) await scheduleCategory(db, setting.category);
}

export async function getLaundryReminder(db: SQLiteDatabase): Promise<LaundryReminder> {
  const reminder = await db.getFirstAsync<LaundryReminder>(
    "SELECT is_active, started_at, honor_quiet_hours FROM laundry_reminder WHERE id = 1",
  );
  return (
    reminder ?? {
      is_active: 0,
      started_at: null,
      honor_quiet_hours: 0,
    }
  );
}

export async function setLaundryReminder(
  db: SQLiteDatabase,
  active: boolean,
  honorQuietHours = false,
) {
  await db.runAsync(
    "UPDATE laundry_reminder SET is_active = ?, started_at = ?, honor_quiet_hours = ? WHERE id = 1",
    active ? 1 : 0,
    active ? new Date().toISOString() : null,
    honorQuietHours ? 1 : 0,
  );
  await cancelCategory("laundry");
  if (active) await scheduleCategory(db, "laundry");
  return getLaundryReminder(db);
}
