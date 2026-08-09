import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getDecks } from "@/database/queries/study";
import type { Deck } from "@/database/types";

export default function DecksScreen() {
  const { subjectId, subjectName } = useLocalSearchParams<{
    subjectId: string;
    subjectName: string;
  }>();
  const db = useSQLiteContext();
  const [decks, setDecks] = useState<Deck[]>([]);
  const id = Number(subjectId);

  useFocusEffect(
    useCallback(() => {
      if (Number.isFinite(id)) void getDecks(db, id).then(setDecks);
    }, [db, id]),
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>{subjectName || "Decks"}</Text>

        {decks.map((deck) => (
          <View key={deck.id} style={styles.card}>
            <Text style={styles.deck}>{deck.name}</Text>
            <View style={styles.buttons}>
              <Link
                href={{
                  pathname: "/study/flashcards",
                  params: { deckId: deck.id, deckName: deck.name },
                }}
                asChild
              >
                <Pressable style={styles.primary}>
                  <Text style={styles.primaryText}>Flashcards</Text>
                </Pressable>
              </Link>
              <Link
                href={{
                  pathname: "/study/mcqs",
                  params: { deckId: deck.id, deckName: deck.name },
                }}
                asChild
              >
                <Pressable style={styles.secondary}>
                  <Text style={styles.secondaryText}>MCQs</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Link
          href={{
            pathname: "/import",
            params: { prefillSubject: subjectName },
          }}
          asChild
        >
          <Pressable style={styles.importAction}>
            <Text style={styles.importActionTitle}>
              ➕ Add material to {subjectName}
            </Text>
            <Text style={styles.importActionText}>
              Import new JSON specifically into this subject.
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
  title: { fontSize: 26, fontWeight: "800", color: "#3E2B23", marginBottom: 8 },
  card: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#FFF",
    gap: 14,
    borderWidth: 1,
    borderColor: "#E7D5C9",
  },
  deck: { fontSize: 18, fontWeight: "700", color: "#3E2B23" },
  buttons: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#D96642",
  },
  primaryText: { color: "#FFF", fontWeight: "700" },
  secondary: {
    flex: 1,
    alignItems: "center",
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D96642",
  },
  secondaryText: { color: "#9E452C", fontWeight: "700" },
  footer: { padding: 20, paddingBottom: 30 },
  importAction: {
    backgroundColor: "#2E8B57",
    padding: 18,
    borderRadius: 14,
    gap: 4,
  },
  importActionTitle: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  importActionText: { color: "#E0F2E9", fontSize: 13 },
});
