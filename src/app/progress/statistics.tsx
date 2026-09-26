import { formatDay, formatDuration } from "@/utils/format";
import { DAILY_GOAL } from "@/constants/goals";
import { getSubjectStats } from "@/database/queries/study";
import type { Streak } from "@/database/types";
import { getStreak } from "@/services/streakService";
import {
  studyTimeSummary,
  subjectStudyTime,
} from "@/services/studyTimeService";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Summary = Awaited<ReturnType<typeof studyTimeSummary>>;
type SubjectRow = Awaited<ReturnType<typeof getSubjectStats>>[number];

export default function StatisticsScreen() {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [timeBySubject, setTimeBySubject] = useState<
    { name: string; seconds: number }[]
  >([]);
  const [streak, setStreak] = useState<Streak | null>(null);

  const load = useCallback(() => {
    void Promise.all([
      studyTimeSummary(db),
      getSubjectStats(db),
      subjectStudyTime(db),
      getStreak(db),
    ]).then(([time, library, timed, streakRow]) => {
      setSummary(time);
      setSubjects(library);
      setTimeBySubject(timed);
      setStreak(streakRow);
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const studied = summary?.days.filter((day) => day.study_seconds > 0) ?? [];
  const items = (summary?.days ?? []).reduce(
    (sum, day) => sum + day.items_completed,
    0,
  );
  const activeDays = (summary?.days ?? []).filter(
    (day) => day.items_completed > 0,
  ).length;
  const goalDays = (summary?.days ?? []).filter(
    (day) => day.items_completed >= DAILY_GOAL,
  ).length;

  const secondsByName = new Map(
    timeBySubject.map((row) => [row.name, row.seconds]),
  );
  const longest = Math.max(1, ...timeBySubject.map((row) => row.seconds));
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.heading}>Study time</Text>
        <Text>Today: {formatDuration(summary?.today)}</Text>
        <Text>This week: {formatDuration(summary?.week)}</Text>
        <Text>This month: {formatDuration(summary?.month)}</Text>
        <Text>All together: {formatDuration(summary?.total)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Streak</Text>
        <Text>
          {streak?.is_dead ? "Pippo is sleeping. " : ""}Current:{" "}
          {streak?.current_streak ?? 0} days · Longest:{" "}
          {streak?.longest_streak ?? 0} days
        </Text>
        <Text>❄️ Freezes available: {streak?.freeze_count ?? 0}</Text>
        <Text>
          Last day completed:{" "}
          {streak?.last_completed_date
            ? formatDay(streak.last_completed_date)
            : "not yet"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Work done</Text>
        <Text>
          Items completed: {items} across {activeDays} days
        </Text>
        <Text>
          Days that hit the {DAILY_GOAL}-item goal: {goalDays}
        </Text>
        {studied.length > 0 && (
          <Text>
            Average on a study day:{" "}
            {formatDuration(
              Math.round((summary?.total ?? 0) / Math.max(1, studied.length)),
            )}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Subject statistics</Text>
        {subjects.length === 0 && <Text>No subjects imported yet.</Text>}
        {subjects.map((subject) => {
          const seconds = secondsByName.get(subject.name) ?? 0;
          return (
            <View key={subject.id} style={styles.subject}>
              <View style={styles.row}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectTime}>
                  {seconds > 0 ? formatDuration(seconds) : "no time yet"}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.min(100, (100 * seconds) / longest)}%` },
                  ]}
                />
              </View>
              <Text style={styles.subjectMeta}>
                {subject.decks} decks · {subject.cards} flashcards ·{" "}
                {subject.mcqs} MCQs
                {subject.weak > 0 ? ` · ${subject.weak} weak` : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, backgroundColor: "#FFF9F2" },
  heading: { fontSize: 16, fontWeight: "800", color: "#3E2B23" },
  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 14, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  subject: { gap: 4 },
  subjectName: { fontWeight: "800", color: "#3E2B23" },
  subjectTime: { color: "#9E452C", fontWeight: "700" },
  subjectMeta: { color: "#B07863", fontSize: 12 },
  track: {
    height: 10,
    borderRadius: 8,
    backgroundColor: "#F3E4D6",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#E9875C", borderRadius: 8 },
});
