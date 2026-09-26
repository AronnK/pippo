import { DAILY_GOAL } from "@/constants/goals";
import type { Streak } from "@/database/types";
import { getStreak } from "@/services/streakService";
import {
    studyTimeSummary,
    subjectStudyTime,
} from "@/services/studyTimeService";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
const local = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
const fmt = (n = 0) =>
  n < 3600
    ? `${Math.floor(n / 60)}m`
    : `${Math.floor(n / 3600)}h ${String(Math.floor(n / 60) % 60).padStart(2, "0")}m`;
export default function Calendar() {
  const db = useSQLiteContext();
  const [month, setMonth] = useState(new Date());
  const [days, setDays] = useState<string[]>([]);
  const [first, setFirst] = useState<string | null>(null);
  const [items, setItems] = useState(0);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [time, setTime] = useState<any>();
  const [subjects, setSubjects] = useState<{ name: string; seconds: number }[]>(
    [],
  );
  const load = useCallback(() => {
    void Promise.all([
      db.getAllAsync<{ date: string }>(
        `SELECT date FROM daily_stats WHERE items_completed>=${DAILY_GOAL}`,
      ),
      db.getFirstAsync<{ total: number; first: string | null }>(
        "SELECT COALESCE(SUM(items_completed),0) total,MIN(date) first FROM daily_stats",
      ),
      getStreak(db),
      studyTimeSummary(db),
      subjectStudyTime(db),
    ]).then(([d, s, st, t, sub]) => {
      setDays(d.map((x) => x.date));
      setItems(s?.total ?? 0);
      setFirst(s?.first ?? null);
      setStreak(st);
      setTime(t);
      setSubjects(sub);
    });
  }, [db]);
  useFocusEffect(load);
  const y = month.getFullYear(),
    m = month.getMonth(),
    offset = new Date(y, m, 1).getDay(),
    count = new Date(y, m + 1, 0).getDate(),
    today = local(new Date()),
    cells = Array.from({ length: offset + count }, (_, i) =>
      i < offset ? null : i - offset + 1,
    ),
    prefix = `${y}-${String(m + 1).padStart(2, "0")}`,
    thisMonth = days.filter((x) => x.startsWith(prefix)).length,
    graph = (time?.days ?? []).slice(-7),
    max = Math.max(1, ...graph.map((x: any) => x.study_seconds));
  const monday = new Date();
  monday.setDate(monday.getDate() - monday.getDay());
  const last = new Date(monday);
  last.setDate(last.getDate() - 7);
  const thisWeek = (time?.days ?? [])
      .filter((x: any) => x.date >= local(monday))
      .reduce((a: number, x: any) => a + x.study_seconds, 0),
    lastWeek = (time?.days ?? [])
      .filter((x: any) => x.date >= local(last) && x.date < local(monday))
      .reduce((a: number, x: any) => a + x.study_seconds, 0),
    diff = thisWeek - lastWeek;
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Image
        source={require("@/assets/pippo/keep-calm.webp")}
        style={s.image}
        contentFit="contain"
      />
      <Text style={s.hero}>Keep Calm You’re Almost A Doctor, Dr. Puttus</Text>
      <View style={s.nav}>
        <Pressable onPress={() => setMonth(new Date(y, m - 1, 1))}>
          <Text>‹ Previous</Text>
        </Pressable>
        <Text style={s.heading}>
          {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={() => setMonth(new Date(y, m + 1, 1))}>
          <Text>Next ›</Text>
        </Pressable>
      </View>
      <View style={s.grid}>
        {["S", "M", "T", "W", "T", "F", "S"].map((x, i) => (
          <Text key={i} style={s.week}>
            {x}
          </Text>
        ))}
        {cells.map((n, i) => {
          const key = n ? `${prefix}-${String(n).padStart(2, "0")}` : "";
          const miss = Boolean(
            key && first && key >= first && key < today && !days.includes(key),
          );
          return (
            <View
              key={i}
              style={[
                s.cell,
                key === today && s.today,
                days.includes(key) && s.done,
                miss && s.missed,
              ]}
            >
              <Text>{n ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <View style={s.card}>
        <Text>Current streak: {streak?.current_streak ?? 0}</Text>
        <Text>Longest streak: {streak?.longest_streak ?? 0}</Text>
        <Text>Total completed study items: {items}</Text>
        <Text>Total completed study days: {days.length}</Text>
        <Text>Available streak freezes: {streak?.freeze_count ?? 0}</Text>
        <Text>This month’s completed days: {thisMonth}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Study time</Text>
        <Text>Today: {fmt(time?.today)}</Text>
        <Text>This week: {fmt(time?.week)}</Text>
        <Text>This month: {fmt(time?.month)}</Text>
        <Text>Total: {fmt(time?.total)}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Last 7 days</Text>
        <View style={s.bars}>
          {graph.map((x: any) => (
            <View key={x.date} style={s.barItem}>
              <View
                style={[
                  s.bar,
                  { height: Math.max(3, (100 * x.study_seconds) / max) },
                ]}
              />
              <Text>
                {new Date(`${x.date}T00:00:00`)
                  .toLocaleDateString(undefined, { weekday: "short" })
                  .slice(0, 2)}
              </Text>
              <Text>{fmt(x.study_seconds)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.card}>
        <Text>This week: {fmt(thisWeek)}</Text>
        <Text>Last week: {fmt(lastWeek)}</Text>
        <Text>
          {diff >= 0
            ? `↑ ${fmt(diff)} — You studied more this week ❤️`
            : `↓ ${fmt(-diff)} — Last week was stronger. You can catch up.`}
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Subject study time</Text>
        {subjects.length ? (
          subjects.map((x) => (
            <Text key={x.name}>
              {x.name} — {fmt(x.seconds)}
            </Text>
          ))
        ) : (
          <Text>No subject study time yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { padding: 16, gap: 18, backgroundColor: "#FFF9F2" },
  image: { width: "100%", height: 180, borderRadius: 16 },
  hero: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    color: "#3E2B23",
  },
  heading: { fontWeight: "800", fontSize: 16 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  week: {
    width: "14.28%",
    textAlign: "center",
    fontWeight: "800",
    paddingVertical: 9,
  },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#E7D5C9",
  },
  today: { borderWidth: 2, borderColor: "#D96642" },
  done: { backgroundColor: "#BFE8C7" },
  missed: { backgroundColor: "#F6D8D6" },
  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 14, gap: 8 },
  bars: { height: 145, flexDirection: "row", alignItems: "flex-end", gap: 4 },
  barItem: { flex: 1, alignItems: "center", gap: 3 },
  bar: { width: "70%", backgroundColor: "#D96642", borderRadius: 4 },
});
