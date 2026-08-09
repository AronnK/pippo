import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

export default function ImportScreen() {
  const { prefillSubject } = useLocalSearchParams<{
    prefillSubject?: string;
  }>();

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Study Material Hub</Text>
      <Text style={styles.subtitle}>
        {prefillSubject
          ? `Adding new material directly to "${prefillSubject}".`
          : "Generate prompts for NotebookLM, or paste your JSON to add cards to new/existing subjects."}
      </Text>

      <Text style={styles.sectionHeader}>Step 1: Get Prompts</Text>
      <Link href="/import/flashcard-prompt" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>📋 Flashcard Prompt</Text>
          <Text style={styles.cardText}>
            Copy instructions for NotebookLM to generate Flashcards.
          </Text>
        </Pressable>
      </Link>

      <Link href="/import/mcq-prompt" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>📋 MCQ Prompt</Text>
          <Text style={styles.cardText}>
            Copy instructions for NotebookLM to generate MCQs.
          </Text>
        </Pressable>
      </Link>

      <Text style={styles.sectionHeader}>Step 2: Import Data</Text>
      <Link
        href={{
          pathname: "/import/json-import",
          params: { kind: "flashcards", prefillSubject },
        }}
        asChild
      >
        <Pressable style={styles.primaryCard}>
          <Text style={styles.primaryCardTitle}>📥 Paste Flashcard JSON</Text>
          <Text style={styles.primaryCardText}>
            Import flashcards into Pippo.
          </Text>
        </Pressable>
      </Link>

      <Link
        href={{
          pathname: "/import/json-import",
          params: { kind: "mcqs", prefillSubject },
        }}
        asChild
      >
        <Pressable style={styles.primaryCard}>
          <Text style={styles.primaryCardTitle}>📥 Paste MCQ JSON</Text>
          <Text style={styles.primaryCardText}>
            Import multiple-choice questions into Pippo.
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 20,
    gap: 14,
    backgroundColor: "#FFF9F2",
    paddingBottom: 40,
  },
  title: { fontSize: 27, fontWeight: "800", color: "#3E2B23" },
  subtitle: { color: "#6C564D", marginBottom: 10, fontSize: 16 },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: "#8A6758",
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E7D5C9",
  },
  cardTitle: { fontSize: 19, fontWeight: "800", color: "#3E2B23" },
  cardText: { color: "#6C564D" },
  primaryCard: {
    backgroundColor: "#2E8B57",
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  primaryCardTitle: { fontSize: 19, fontWeight: "800", color: "#FFF" },
  primaryCardText: { color: "#E0F2E9" },
});
