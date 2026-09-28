import { Link, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  deleteSubject,
  getSubjectStats,
  getSubjects,
} from "@/database/queries/study";
import type { Subject } from "@/database/types";

type SubjectStat = Awaited<ReturnType<typeof getSubjectStats>>[number];

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function StudySubjectsScreen() {
  const db = useSQLiteContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<Map<number, SubjectStat>>(new Map());

  const load = useCallback(() => {
    void Promise.all([getSubjects(db), getSubjectStats(db)]).then(
      ([rows, counts]) => {
        setSubjects(rows);
        setStats(new Map(counts.map((row) => [row.id, row])));
      },
    );
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (subject: Subject) => {
    const own = stats.get(subject.id);
    const items = (own?.cards ?? 0) + (own?.mcqs ?? 0);
    const body = items
      ? `${subject.name} holds ${plural(own?.decks ?? 0, "deck")} and ${plural(items, "item")} (${own?.cards ?? 0} flashcards, ${own?.mcqs ?? 0} MCQs).${own?.weak ? ` ${own.weak} of them are marked weak.` : ""} All of it goes, and there is no undo.`
      : `${subject.name} has no cards in it yet. Nothing else is affected.`;
    Alert.alert(`Delete ${subject.name}?`, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteSubject(db, subject.id).then(load);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>Your Subjects</Text>

        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>
              You don’t have any subjects yet. Tap below to create your first
              one.
            </Text>
          </View>
        ) : (
          subjects.map((subject) => (
            <View key={subject.id} style={styles.row}>
              <Link
                href={{
                  pathname: "/study/decks",
                  params: { subjectId: subject.id, subjectName: subject.name },
                }}
                asChild
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.rowLink,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.rowText}>{subject.name}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </Link>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${subject.name}`}
                hitSlop={10}
                onPress={() => confirmDelete(subject)}
                style={({ pressed }) => [
                  styles.rowDelete,
                  pressed && styles.deletePressed,
                ]}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Link href="/import" asChild>
          <Pressable style={styles.primaryCard}>
            <Text style={styles.primaryCardTitle}>➕ Create New Subject</Text>
            <Text style={styles.primaryCardText}>
              Generate prompts and import new JSON material.
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  screen: { flexGrow: 1, padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#3E2B23", marginBottom: 4 },
  emptyContainer: {
    marginTop: 10,
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E7D5C9",
  },
  emptySubtitle: { color: "#6C564D", fontSize: 16, lineHeight: 24 },
  row: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  rowLink: {
    flex: 1,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pressed: { opacity: 0.7 },
  rowText: { fontSize: 17, fontWeight: "600", color: "#3E2B23" },
  chevron: { color: "#B07863", fontSize: 20 },
  rowDelete: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderLeftWidth: 1,
    borderColor: "#F3E4D6",
  },
  deletePressed: { backgroundColor: "#F6D8D6" },
  deleteText: { color: "#B42318", fontSize: 17, fontWeight: "800" },
  footer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 30,
    backgroundColor: "#FFF9F2",
  },
  primaryCard: {
    backgroundColor: "#D96642",
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  primaryCardTitle: { fontSize: 17, fontWeight: "800", color: "#FFF" },
  primaryCardText: { color: "#FBE4D9", fontSize: 14 },
});
