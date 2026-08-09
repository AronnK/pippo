import { Link, type Href, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PippoCharacter } from '@/components/PippoCharacter';
import { PIPPO_MESSAGES } from '@/constants/pippoMessages';
import { getTodayStats } from '@/database/queries/study';
import type { LaundryReminder, Streak } from '@/database/types';
import { getLaundryReminder, scheduleEnabledNotifications, setLaundryReminder } from '@/services/notificationService';
import { getCharacterState, type PippoState } from '@/services/pippoState';
import { consumeUnseenMilestone, getStreak, reconcileMissedDays, resolveFreezeDecision } from '@/services/streakService';

const EMPTY_STREAK: Streak = { current_streak: 0, longest_streak: 0, last_completed_date: null, freeze_count: 0, last_awarded_milestone: 0, last_celebrated_milestone: 0, pending_freeze_decision: 0, is_dead: 0 };
const EMPTY_LAUNDRY: LaundryReminder = { is_active: 0, started_at: null };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [completed, setCompleted] = useState(0); const [streak, setStreak] = useState<Streak>(EMPTY_STREAK); const [laundry, setLaundry] = useState<LaundryReminder>(EMPTY_LAUNDRY); const [celebrating, setCelebrating] = useState(false); const alerted = useRef(false);
  const load = useCallback(async () => {
    const [stats, settledStreak, reminder] = await Promise.all([getTodayStats(db), reconcileMissedDays(db), getLaundryReminder(db)]);
    const milestone = await consumeUnseenMilestone(db);
    setCompleted(stats.items_completed); setStreak(milestone ? { ...settledStreak, last_celebrated_milestone: milestone } : await getStreak(db)); setLaundry(reminder); setCelebrating(Boolean(milestone));
    void scheduleEnabledNotifications(db);
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!streak.pending_freeze_decision || alerted.current) return;
    alerted.current = true;
    Alert.alert('Pippo needs you', 'You missed yesterday. Use one streak freeze to save Pippo?', [
      { text: 'Let Pippo Die', style: 'destructive', onPress: () => void resolveFreezeDecision(db, false).then(load) },
      { text: 'Use Streak Freeze', onPress: () => void resolveFreezeDecision(db, true).then(load) },
    ]);
  }, [db, load, streak.pending_freeze_decision]);
  const toggleLaundry = async () => setLaundry(await setLaundryReminder(db, !laundry.is_active));
  const state: PippoState = getCharacterState(streak, completed, celebrating);
  const message = PIPPO_MESSAGES[state][Math.floor(Math.random() * PIPPO_MESSAGES[state].length)];
  const percentage = Math.min(completed / 50, 1) * 100;
  return <ScrollView contentContainerStyle={styles.screen}><View style={styles.header}><Text style={styles.title}>Pippo</Text><Link href={'/settings/notifications' as Href} asChild><Pressable><Text style={styles.settings}>Settings</Text></Pressable></Link></View><PippoCharacter state={state} /><Text style={styles.message}>{message}</Text>{celebrating && <Text style={styles.celebration}>🎉 {streak.current_streak} days together — a streak freeze was earned!</Text>}<View style={styles.card}><View style={styles.streakLine}><Text style={styles.streak}>🔥 {streak.current_streak} day streak</Text><Text style={styles.longest}>Best: {streak.longest_streak}</Text></View><Text style={styles.progress}>{completed} / 50 items today</Text><View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` }]} /></View><Text style={styles.freezes}>❄️ {streak.freeze_count} streak freeze{streak.freeze_count === 1 ? '' : 's'} available</Text></View><Link href="/study" asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>Continue Studying</Text></Pressable></Link><View style={styles.quick}><Link href={'/study/weak' as Href} asChild><Pressable style={styles.quickButton}><Text>Weak Cards</Text></Pressable></Link><Link href={'/study/surprise' as Href} asChild><Pressable style={styles.quickButton}><Text>Surprise Me</Text></Pressable></Link><Link href={'/study/random-quiz' as Href} asChild><Pressable style={styles.quickButton}><Text>Random Quiz</Text></Pressable></Link><Link href={'/calendar' as Href} asChild><Pressable style={styles.quickButton}><Text>Calendar</Text></Pressable></Link></View><Link href={'/study/emergency' as Href} asChild><Pressable style={styles.danger}><Text style={styles.dangerText}>I DON’T WANT PIPPO TO DIE</Text></Pressable></Link><Pressable onPress={() => void toggleLaundry()} style={[styles.laundry, Boolean(laundry.is_active) && styles.laundryActive]}><Text style={styles.laundryText}>{laundry.is_active ? '🧺 CLOTHES WASHED' : '🧺 I PUT MY CLOTHES TO SOAK'}</Text><Text style={styles.laundryHelp}>{laundry.is_active ? 'Laundry reminders are on every 30 minutes.' : 'Pippo can remind you every 30 minutes.'}</Text></Pressable></ScrollView>;
}
const styles = StyleSheet.create({ screen: { padding: 20, paddingBottom: 42, gap: 16, backgroundColor: '#FFF9F2' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 38, fontWeight: '800', color: '#3E2B23' }, settings: { color: '#9E452C', fontWeight: '700' }, message: { color: '#6C564D', textAlign: 'center', fontSize: 18, fontWeight: '600' }, celebration: { textAlign: 'center', color: '#C25A27', backgroundColor: '#FFE9BC', padding: 12, borderRadius: 12, fontWeight: '700' }, card: { backgroundColor: '#FFF', padding: 18, borderRadius: 18, gap: 12 }, streakLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, streak: { fontSize: 19, fontWeight: '800', color: '#3E2B23' }, longest: { color: '#6C564D' }, progress: { fontSize: 17, fontWeight: '700', color: '#3E2B23' }, track: { height: 12, borderRadius: 10, backgroundColor: '#F3E4D6', overflow: 'hidden' }, fill: { height: '100%', backgroundColor: '#E9875C', borderRadius: 10 }, freezes: { color: '#5B7790', fontWeight: '600' }, primary: { backgroundColor: '#D96642', padding: 18, borderRadius: 14, alignItems: 'center' }, primaryText: { color: '#FFF', fontSize: 18, fontWeight: '700' }, quick:{flexDirection:'row',flexWrap:'wrap',gap:8},quickButton:{backgroundColor:'#FFF',borderRadius:10,padding:11,borderWidth:1,borderColor:'#E8D3C3'}, danger: { borderWidth: 1, borderColor: '#B95750', padding: 16, borderRadius: 14, alignItems: 'center' }, dangerText: { color: '#A43E39', fontSize: 14, fontWeight: '800' }, laundry: { backgroundColor: '#FFF', padding: 17, borderRadius: 14, gap: 5, borderWidth: 1, borderColor: '#E8D3C3' }, laundryActive: { backgroundColor: '#FFF0C9', borderColor: '#D49A35' }, laundryText: { color: '#3E2B23', fontWeight: '800', fontSize: 16 }, laundryHelp: { color: '#6C564D', fontSize: 13 } });
