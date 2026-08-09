import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Image, Platform } from 'react-native';

import { NOTIFICATION_MESSAGES } from '@/constants/pippoMessages';
import type { LaundryReminder, NotificationCategory, NotificationSetting } from '@/database/types';

const CATEGORIES: NotificationCategory[] = ['hydration', 'sleep', 'study', 'miss_you', 'laundry', 'keep_calm'];
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

const assets = {
  hydration: require('@/assets/pippo/hydrate.jpeg'),
  sleep: require('@/assets/pippo/sleep-1.jpeg'),
  study: require('@/assets/pippo/no-phone.jpeg'),
  miss_you: require('@/assets/pippo/miss-you-1.jpeg'),
  laundry: require('@/assets/pippo/laundry.jpeg'),
  keep_calm: require('@/assets/pippo/keep-calm.jpeg'),
} as const;

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

function pick<T>(items: readonly T[]) { return items[Math.floor(Math.random() * items.length)]; }
function attachment(category: NotificationCategory) {
  if (Platform.OS !== 'ios') return undefined;
  const source = Image.resolveAssetSource(category === 'sleep' ? pick([require('@/assets/pippo/sleep-1.jpeg'), require('@/assets/pippo/sleep-2.jpeg')]) : category === 'miss_you' ? pick([require('@/assets/pippo/miss-you-1.jpeg'), require('@/assets/pippo/miss-you-2.jpeg'), require('@/assets/pippo/miss-you-3.jpeg'), require('@/assets/pippo/miss-you-4.jpeg')]) : assets[category]);
  return [{ identifier: category, url: source.uri, type: 'public.jpeg' }];
}
function content(category: NotificationCategory) {
  return { title: category === 'laundry' ? 'Pippo laundry reminder' : 'Pippo', body: pick(NOTIFICATION_MESSAGES[category]), data: { pippoCategory: category }, sound: 'default' as const, ...(attachment(category) ? { attachments: attachment(category) } : {}) };
}
function dailyTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
  if (Platform.OS === 'android') return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute };
  return { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, repeats: true, hour, minute };
}

export async function ensureNotificationSettings(db: SQLiteDatabase) {
  for (const category of CATEGORIES) await db.runAsync('INSERT OR IGNORE INTO notification_settings (category, is_enabled) VALUES (?, 1)', category);
  return db.getAllAsync<NotificationSetting>('SELECT category, is_enabled FROM notification_settings ORDER BY category');
}
export async function getNotificationSettings(db: SQLiteDatabase) { return ensureNotificationSettings(db); }
export async function setNotificationEnabled(db: SQLiteDatabase, category: NotificationCategory, enabled: boolean) {
  await db.runAsync('INSERT INTO notification_settings (category, is_enabled) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET is_enabled = excluded.is_enabled', category, enabled ? 1 : 0);
  if (enabled) await scheduleCategory(db, category); else await cancelCategory(category);
}
async function permissionGranted() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('pippo-reminders', { name: 'Pippo reminders', importance: Notifications.AndroidImportance.DEFAULT });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  return permission.granted;
}
export async function cancelCategory(category: NotificationCategory) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((item) => item.content.data?.pippoCategory === category).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  } catch {
    // There may be no notification service available in an unsupported runtime.
  }
}
export async function scheduleCategory(db: SQLiteDatabase, category: NotificationCategory) {
  try {
    const setting = await db.getFirstAsync<NotificationSetting>('SELECT category, is_enabled FROM notification_settings WHERE category = ?', category);
    if (!setting?.is_enabled || !(await permissionGranted())) return;
    await cancelCategory(category);
    if (category === 'hydration') {
      for (const hour of [9, 11, 13, 15, 17, 19, 21]) await Notifications.scheduleNotificationAsync({ content: content(category), trigger: dailyTrigger(hour, 0) });
    } else if (category === 'sleep') {
      for (const hour of [22, 23]) await Notifications.scheduleNotificationAsync({ content: content(category), trigger: dailyTrigger(hour, 0) });
    } else if (category === 'study') {
      await Notifications.scheduleNotificationAsync({ content: content(category), trigger: dailyTrigger(18, 0) });
    } else if (category === 'miss_you') {
      for (const days of [3, 8]) await Notifications.scheduleNotificationAsync({ content: content(category), trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + days * 86_400_000) } });
  } else if (category === 'keep_calm') {
    let next = Date.now();
    for (let index = 0; index < 4; index += 1) { next += (Math.random() < 0.5 ? 4 : 5) * 86_400_000; await Notifications.scheduleNotificationAsync({ content: content(category), trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(next) } }); }
  } else {
      const laundry = await getLaundryReminder(db);
      if (laundry.is_active) await Notifications.scheduleNotificationAsync({ content: content(category), trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1800, repeats: true } });
    }
  } catch {
    // Notification permissions and scheduling may be unavailable; the app must stay usable.
  }
}
export async function scheduleEnabledNotifications(db: SQLiteDatabase) {
  const settings = await ensureNotificationSettings(db);
  for (const setting of settings) if (setting.is_enabled) await scheduleCategory(db, setting.category);
}
export async function getLaundryReminder(db: SQLiteDatabase) {
  const reminder = await db.getFirstAsync<LaundryReminder>('SELECT is_active, started_at FROM laundry_reminder WHERE id = 1');
  return reminder ?? { is_active: 0, started_at: null };
}
export async function setLaundryReminder(db: SQLiteDatabase, active: boolean) {
  await db.runAsync('UPDATE laundry_reminder SET is_active = ?, started_at = ? WHERE id = 1', active ? 1 : 0, active ? new Date().toISOString() : null);
  await cancelCategory('laundry');
  if (active) await scheduleCategory(db, 'laundry');
  return getLaundryReminder(db);
}
export { QUIET_END_HOUR, QUIET_START_HOUR };
