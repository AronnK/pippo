import { Link, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getSubjects } from "@/database/queries/study";
import type { Subject } from "@/database/types";

export default function StudySubjectsScreen() {
  const db = useSQLiteContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useFocusEffect(
    useCallback(() => {
      void getSubjects(db).then(setSubjects);
    }, [db]),
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>Your Subjects</Text>

        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>
              You don't have any subjects yet. Tap below to create your first
              one.
            </Text>
          </View>
        ) : (
          subjects.map((subject) => (
            <Link
              key={subject.id}
              href={{
                pathname: "/study/decks",
                params: { subjectId: subject.id, subjectName: subject.name },
              }}
              asChild
            >
              <Pressable style={styles.row}>
                <Text style={styles.rowText}>{subject.name}</Text>
                <Text>›</Text>
              </Pressable>
            </Link>
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
    padding: 18,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 17, fontWeight: "600", color: "#3E2B23" },
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
