import { Link, Stack, useFocusEffect, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PippoCharacter } from "@/components/PippoCharacter";
import { SidebarDrawer } from "@/components/SidebarDrawer";
import { PIPPO_MESSAGES } from "@/constants/pippoMessages";
import { getTodayStats } from "@/database/queries/study";
import type { LaundryReminder, Streak } from "@/database/types";
import {
  getLaundryReminder,
  scheduleEnabledNotifications,
  setLaundryReminder,
} from "@/services/notificationService";
import { getCharacterState, type PippoState } from "@/services/pippoState";
import {
  consumeUnseenMilestone,
  getStreak,
  reconcileMissedDays,
  resolveFreezeDecision,
} from "@/services/streakService";
import {
  getManualTimer,
  startSession,
  stopSession,
} from "@/services/studyTimeService";

const EMPTY_STREAK: Streak = {
  current_streak: 0,
  longest_streak: 0,
  last_completed_date: null,
  freeze_count: 0,
  last_awarded_milestone: 0,
  last_celebrated_milestone: 0,
  pending_freeze_decision: 0,
  is_dead: 0,
};
const EMPTY_LAUNDRY: LaundryReminder = { is_active: 0, started_at: null };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [completed, setCompleted] = useState(0);
  const [streak, setStreak] = useState(EMPTY_STREAK);
  const [laundry, setLaundry] = useState(EMPTY_LAUNDRY);
  const [celebrating, setCelebrating] = useState(false);
  const [menu, setMenu] = useState(false);
  const [timer, setTimer] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alerted = useRef(false);

  const load = useCallback(async () => {
    const [stats, settledStreak, reminder] = await Promise.all([
      getTodayStats(db),
      reconcileMissedDays(db),
      getLaundryReminder(db),
    ]);
    const milestone = await consumeUnseenMilestone(db);
    setCompleted(stats.items_completed);
    setStreak(
      milestone
        ? { ...settledStreak, last_celebrated_milestone: milestone }
        : await getStreak(db),
    );
    setLaundry(reminder);
    setCelebrating(Boolean(milestone));
    void scheduleEnabledNotifications(db);
    void getManualTimer(db).then((row) => setTimer(row?.start_time ?? null));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!streak.pending_freeze_decision || alerted.current) return;
    alerted.current = true;
    Alert.alert(
      "Pippo needs you",
      "You missed yesterday. Use one streak freeze to save Pippo?",
      [
        {
          text: "Let Pippo Die",
          style: "destructive",
          onPress: () => void resolveFreezeDecision(db, false).then(load),
        },
        {
          text: "Use Streak Freeze",
          onPress: () => void resolveFreezeDecision(db, true).then(load),
        },
      ],
    );
  }, [db, load, streak.pending_freeze_decision]);

  useEffect(() => {
    const id = setInterval(
      () =>
        setElapsed(
          timer
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(timer).getTime()) / 1000),
              )
            : 0,
        ),
      1000,
    );
    return () => clearInterval(id);
  }, [timer]);

  const toggleLaundry = async () =>
    setLaundry(await setLaundryReminder(db, !laundry.is_active));

  const state: PippoState = getCharacterState(streak, completed, celebrating);
  const message =
    PIPPO_MESSAGES[state][
      Math.floor(Math.random() * PIPPO_MESSAGES[state].length)
    ];
  const percentage = Math.min(completed / 50, 1) * 100;

  const timerToggle = async () => {
    if (timer) {
      await stopSession(db, "manual");
      setTimer(null);
    } else {
      await startSession(db, "manual");
      setTimer((await getManualTimer(db))?.start_time ?? null);
    }
  };

  const risk =
    completed < 50 && streak.current_streak > 0 && new Date().getHours() >= 20;

  return (
    <View
      style={[styles.screen, { paddingTop: Math.max(insets.top, 20) + 16 }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => setMenu(true)}>
          <Text style={styles.settings}>☰ Menu</Text>
        </Pressable>
        <Text style={styles.title}>Pippo</Text>
      </View>

      <PippoCharacter state={state} />

      <Text style={styles.message}>{message}</Text>

      {celebrating && (
        <Text style={styles.celebration}>
          🎉 {streak.current_streak} days together — a streak freeze was earned!
        </Text>
      )}

      <View style={styles.card}>
        <View style={styles.streakLine}>
          <Text style={styles.streak}>
            🔥 {streak.current_streak} day streak
          </Text>
          <Text style={styles.longest}>Best: {streak.longest_streak}</Text>
        </View>

        <Text style={styles.progress}>{completed} / 50 items today</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percentage}%` }]} />
        </View>

        <Text style={styles.freezes}>
          ❄️ {streak.freeze_count} streak freeze
          {streak.freeze_count === 1 ? "" : "s"} available
        </Text>
      </View>

      <Link href={"/study" as Href} asChild>
        <Pressable style={styles.primary}>
          <Text style={styles.primaryText}>Continue Studying</Text>
        </Pressable>
      </Link>

      <Pressable onPress={() => void timerToggle()} style={styles.timer}>
        <Text style={styles.timerText}>
          {timer
            ? `⏸ STOP STUDY TIMER · ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : "▶ START STUDY TIMER"}
        </Text>
      </Pressable>

      {risk && (
        <Link href={"/study/emergency" as Href} asChild>
          <Pressable style={styles.danger}>
            <Text style={styles.dangerText}>I DON'T WANT PIPPO TO DIE</Text>
          </Pressable>
        </Link>
      )}

      {/* RENDER UNCONDITIONALLY - Modal handles the visibility internally */}
      <SidebarDrawer visible={menu} onClose={() => setMenu(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    paddingBottom: 42,
    gap: 16,
    backgroundColor: "#FFF9F2",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 38, fontWeight: "800", color: "#3E2B23" },
  settings: { color: "#9E452C", fontWeight: "700", fontSize: 18 },
  message: {
    color: "#6C564D",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  celebration: {
    textAlign: "center",
    color: "#C25A27",
    backgroundColor: "#FFE9BC",
    padding: 12,
    borderRadius: 12,
    fontWeight: "700",
  },
  card: { backgroundColor: "#FFF", padding: 18, borderRadius: 18, gap: 12 },
  streakLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streak: { fontSize: 19, fontWeight: "800", color: "#3E2B23" },
  longest: { color: "#6C564D" },
  progress: { fontSize: 17, fontWeight: "700", color: "#3E2B23" },
  track: {
    height: 12,
    borderRadius: 10,
    backgroundColor: "#F3E4D6",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#E9875C", borderRadius: 10 },
  freezes: { color: "#5B7790", fontWeight: "600" },
  primary: {
    backgroundColor: "#D96642",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  timer: {
    borderWidth: 1,
    borderColor: "#D96642",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  timerText: { color: "#9E452C", fontWeight: "800" },
  danger: {
    borderWidth: 1,
    borderColor: "#B95750",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  dangerText: { color: "#A43E39", fontSize: 14, fontWeight: "800" },
});
