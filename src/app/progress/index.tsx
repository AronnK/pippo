import { formatDay, formatDuration } from "@/utils/format";
import { DAILY_GOAL } from "@/constants/goals";
import { localDate } from "@/database/queries/study";
import type { Streak } from "@/database/types";
import { getStreak } from "@/services/streakService";
import {
  dailySeries,
  dayBreakdown,
  growthInsights,
  studyTimeSummary,
  shiftDate,
  weekStart,
  type DayBreakdown,
  type DaySummary,
  type GrowthInsights,
} from "@/services/studyTimeService";
import { Image } from "expo-image";
import { Link, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Summary = Awaited<ReturnType<typeof studyTimeSummary>>;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const [month, setMonth] = useState(new Date());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [week, setWeek] = useState<DaySummary[]>([]);
  const [growth, setGrowth] = useState<GrowthInsights | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayBreakdown | null>(null);

  const load = useCallback(() => {
    const today = localDate();
    void Promise.all([
      studyTimeSummary(db),
      getStreak(db),
      // Two blocks of days: last week in full, and this week up to today.
      dailySeries(db, shiftDate(weekStart(today), -7), today),
      growthInsights(db),
    ]).then(([time, st, days, insights]) => {
      setSummary(time);
      setStreak(st);
      setWeek(days);
      setGrowth(insights);
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openDay = (date: string) => {
    setPicked(date);
    setDetail(null);
    void dayBreakdown(db, date).then(setDetail);
  };

  const today = localDate();
  const byDay = new Map((summary?.days ?? []).map((day) => [day.date, day]));
  const first = summary?.days[0]?.date;
  const hit = (date: string) =>
    (byDay.get(date)?.items_completed ?? 0) >= DAILY_GOAL;
  const missed = (date: string) =>
    first !== undefined && date >= first && date < today && !hit(date);

  const y = month.getFullYear();
  const m = month.getMonth();
  const offset = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
  const monday = weekStart(today);
  const lastWeek = week.filter((day) => day.date < monday);
  const thisWeek = week.filter((day) => day.date >= monday);
  const tallest = Math.max(1, ...week.map((day) => day.seconds));

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Image
        source={require("@/assets/pippo/keep-calm.webp")}
        style={styles.hero}
        contentFit="contain"
      />
      <Text style={styles.heroText}>
        Keep Calm You’re Almost A Doctor, Dr. Puttus
      </Text>

      <View style={styles.nav}>
        <Pressable onPress={() => setMonth(new Date(y, m - 1, 1))}>
          <Text style={styles.navText}>‹ Previous</Text>
        </Pressable>
        <Text style={styles.heading}>
          {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={() => setMonth(new Date(y, m + 1, 1))}>
          <Text style={styles.navText}>Next ›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((label, index) => (
          <Text key={index} style={styles.weekday}>
            {label}
          </Text>
        ))}
        {Array.from({ length: offset + count }, (_, index) => {
          if (index < offset) return <View key={index} style={styles.cell} />;
          const date = `${prefix}-${String(index - offset + 1).padStart(2, "0")}`;
          const seconds = byDay.get(date)?.study_seconds ?? 0;
          const glyph = hit(date) ? "🔥" : missed(date) ? "💀" : "";
          return (
            <Pressable
              key={index}
              onPress={() => openDay(date)}
              style={[
                styles.cell,
                date === today && styles.today,
                hit(date) && styles.done,
                missed(date) && styles.missed,
                date === picked && styles.picked,
              ]}
            >
              <Text style={styles.cellDay}>{index - offset + 1}</Text>
              <Text style={styles.cellGlyph}>{glyph}</Text>
              <Text style={styles.cellTime}>
                {seconds > 0 ? formatDuration(seconds) : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.heading}>This week</Text>
          {growth?.change != null && (
            <Text style={growth.change >= 0 ? styles.up : styles.down}>
              {growth.change >= 0 ? "+" : ""}
              {growth.change}% vs last week
            </Text>
          )}
        </View>
        <View style={styles.bars}>
          {thisWeek.map((day) => (
            <Pressable
              key={day.date}
              onPress={() => openDay(day.date)}
              style={styles.barItem}
            >
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.lastWeekBar,
                    {
                      height: Math.max(
                        2,
                        (100 *
                          (lastWeek.find(
                            (x) => x.date === shiftDate(day.date, -7),
                          )?.seconds ?? 0)) /
                          tallest,
                      ),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(3, (100 * day.seconds) / tallest) },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "narrow",
                  },
                )}
              </Text>
              <Text style={styles.barTime}>
                {day.seconds > 0 ? formatDuration(day.seconds) : ""}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.legend}>
          Pale bar: the same day last week ·{" "}
          {formatDuration(growth?.thisWeek ?? 0)} this week vs{" "}
          {formatDuration(growth?.lastWeek ?? 0)} last week
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>How it’s going</Text>
        {!growth || !summary ? (
          <Text>Study a little and Pippo will have something to say.</Text>
        ) : (
          <>
            {growth.longestDay && (
              <Text>
                Longest day: {formatDay(growth.longestDay.date)} —{" "}
                {formatDuration(growth.longestDay.seconds)}
              </Text>
            )}
            {growth.bestWeek && (
              <Text>
                Best week: starting {formatDay(growth.bestWeek.start)} —{" "}
                {formatDuration(growth.bestWeek.seconds)}
              </Text>
            )}
            <Text>
              {growth.studiedDays} of the last {growth.windowDays} days had
              studying in them.
            </Text>
            <Text style={styles.gentle}>{encouragement(growth)}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Streak</Text>
        <Text>Current: {streak?.current_streak ?? 0} days</Text>
        <Text>Longest: {streak?.longest_streak ?? 0} days</Text>
        <Text>
          Days that hit {DAILY_GOAL}:{" "}
          {summary?.days.filter((day) => day.items_completed >= DAILY_GOAL)
            .length ?? 0}
        </Text>
        <Text>❄️ Freezes available: {streak?.freeze_count ?? 0}</Text>
        <Link href="/progress/statistics" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Full statistics</Text>
          </Pressable>
        </Link>
      </View>

      <Modal
        transparent
        visible={picked !== null}
        animationType="fade"
        onRequestClose={() => setPicked(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPicked(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {picked ? formatDay(picked) : ""}{" "}
              {picked && hit(picked)
                ? "🔥"
                : picked && missed(picked)
                  ? "💀"
                  : ""}
            </Text>
            {!detail ? (
              <Text style={styles.sheetLine}>Loading…</Text>
            ) : (
              <>
                <Text style={styles.sheetLine}>
                  Time: {formatDuration(detail.seconds)}
                </Text>
                <Text style={styles.sheetLine}>
                  Items: {detail.items} ({detail.flashcards} flashcards ·{" "}
                  {detail.mcqs} MCQs)
                </Text>
                <Text style={styles.sheetHeading}>By subject</Text>
                {detail.subjects.length ? (
                  detail.subjects.map((subject) => (
                    <Text key={subject.name} style={styles.sheetLine}>
                      {subject.name} — {formatDuration(subject.seconds)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.sheetLine}>
                    Pippo doesn’t know which subject this time went to.
                  </Text>
                )}
              </>
            )}
            <Pressable onPress={() => setPicked(null)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// Spec 4.8: a dip is met gently, never with a scolding.
function encouragement(growth: GrowthInsights) {
  if (growth.change == null) return "A fresh week — let’s see where it goes.";
  if (growth.change > 0)
    return `Up ${growth.change}% on last week. Pippo noticed.`;
  if (growth.change === 0) return "Level with last week. Steady counts too.";
  return "You’ve studied less this week than last — that’s okay, let’s pick it back up.";
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 18, backgroundColor: "#FFF9F2" },
  hero: { width: "100%", height: 170, borderRadius: 16 },
  heroText: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    color: "#3E2B23",
  },
  heading: { fontSize: 16, fontWeight: "800", color: "#3E2B23" },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navText: { color: "#9E452C", fontWeight: "700", fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.28%",
    textAlign: "center",
    fontWeight: "800",
    color: "#B07863",
    paddingVertical: 6,
  },
  cell: {
    width: "14.28%",
    aspectRatio: 0.9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#E7D5C9",
    backgroundColor: "#FFF",
    gap: 1,
  },
  today: { borderWidth: 2, borderColor: "#D96642" },
  done: { backgroundColor: "#BFE8C7" },
  missed: { backgroundColor: "#F6D8D6" },
  picked: { backgroundColor: "#FFE9BC" },
  cellDay: { color: "#3E2B23", fontWeight: "700", fontSize: 13 },
  cellGlyph: { fontSize: 11 },
  cellTime: { fontSize: 9, color: "#6C564D" },
  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 14, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  up: { color: "#2E8B57", fontWeight: "800" },
  down: { color: "#9E452C", fontWeight: "800" },
  bars: { height: 130, flexDirection: "row", alignItems: "flex-end", gap: 4 },
  barItem: { flex: 1, alignItems: "center", gap: 3 },
  barTrack: {
    height: 110,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  bar: { width: "38%", backgroundColor: "#D96642", borderRadius: 4 },
  lastWeekBar: { width: "22%", backgroundColor: "#F0CDB6", borderRadius: 4 },
  barLabel: { color: "#6C564D", fontSize: 11, fontWeight: "700" },
  barTime: { color: "#B07863", fontSize: 9 },
  legend: { color: "#B07863", fontSize: 12 },
  gentle: { color: "#6C564D" },
  link: {
    backgroundColor: "#D96642",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  linkText: { color: "#FFF", fontWeight: "800" },
  backdrop: {
    flex: 1,
    backgroundColor: "#3E2B23AA",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#FFF9F2", borderRadius: 18, padding: 20, gap: 8 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#3E2B23" },
  sheetHeading: {
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: "800",
    color: "#B07863",
    marginTop: 6,
  },
  sheetLine: { color: "#55423A", fontSize: 15 },
  close: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D96642",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  closeText: { color: "#9E452C", fontWeight: "800" },
});
