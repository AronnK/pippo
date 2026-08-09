import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import type { NotificationCategory, NotificationSetting } from '@/database/types';
import { getNotificationSettings, setNotificationEnabled } from '@/services/notificationService';

const labels: Record<NotificationCategory, string> = { hydration: 'Hydration', sleep: 'Sleep', study: 'Study / don’t use phone', miss_you: 'Miss You', laundry: 'Laundry', keep_calm: 'Keep Calm' };
export default function NotificationSettingsScreen() {
  const db = useSQLiteContext(); const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const load = useCallback(() => { void getNotificationSettings(db).then(setSettings); }, [db]);
  useFocusEffect(load);
  const toggle = async (category: NotificationCategory, enabled: boolean) => { await setNotificationEnabled(db, category, enabled); load(); };
  return <ScrollView contentContainerStyle={styles.screen}><Text style={styles.title}>Notifications</Text><Text style={styles.help}>Choose which Pippo reminders you want. Sleep reminders are scheduled after 10 PM.</Text>{settings.map((setting) => <View key={setting.category} style={styles.row}><Text style={styles.label}>{labels[setting.category]}</Text><Switch value={Boolean(setting.is_enabled)} onValueChange={(enabled) => void toggle(setting.category, enabled)} /></View>)}</ScrollView>;
}
const styles = StyleSheet.create({ screen: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: '#FFF9F2' }, title: { fontSize: 27, fontWeight: '800', color: '#3E2B23' }, help: { color: '#6C564D', lineHeight: 21, marginBottom: 8 }, row: { backgroundColor: '#FFF', padding: 17, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { color: '#3E2B23', fontSize: 17, fontWeight: '700' } });
