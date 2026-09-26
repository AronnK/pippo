import { MixedStudySession } from "@/components/MixedStudySession";
import { DAILY_GOAL } from "@/constants/goals";
import { selectRandomItems } from "@/database/queries/quality";
import { getDecksWithCounts } from "@/database/queries/study";
import type { DeckSummary, StudyItem, StudyScope } from "@/database/types";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function RandomQuizScreen() {
  const db = useSQLiteContext();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [items, setItems] = useState<StudyItem[] | null>(null);
  const [scopeLabel, setScopeLabel] = useState("");

  useEffect(() => {
    void getDecksWithCounts(db).then(setDecks);
  }, [db]);

  const start = (scope: StudyScope, label: string) => {
    setScopeLabel(label);
    void selectRandomItems(db, scope, DAILY_GOAL).then(setItems);
  };

  if (items?.length)
    return (
      <MixedStudySession db={db} items={items} source="random_quiz" />
    );

  if (items)
    return (
      <View style={styles.center}>
        <Text style={styles.done}>Nothing to pull from {scopeLabel}.</Text>
        <Text style={styles.sub}>
          It has no flashcards or MCQs imported yet.
        </Text>
        <Pressable onPress={() => setItems(null)} style={styles.action}>
          <Text style={styles.actionText}>Choose another scope</Text>
        </Pressable>
      </View>
    );

  const bySubject = new Map<
    number,
    { name: string; decks: DeckSummary[]; items: number }
  >();
  let total = 0;
  for (const deck of decks) {
    const group = bySubject.get(deck.subject_id) ?? {
      name: deck.subject_name,
      decks: [],
      items: 0,
    };
    group.decks.push(deck);
    group.items += deck.items;
    bySubject.set(deck.subject_id, group);
    total += deck.items;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Random Quiz</Text>
      <Text style={styles.help}>
        {DAILY_GOAL} flashcards and MCQs, shuffled, from wherever you pick.
      </Text>
      <Pressable
        disabled={!total}
        onPress={() => start({}, "all subjects")}
        style={[styles.row, styles.headline, !total && styles.dimmed]}
      >
        <Text style={styles.inverseText}>All subjects</Text>
        <Text style={styles.inverseCount}>{total}</Text>
      </Pressable>
      {[...bySubject.entries()].map(([subjectId, group]) => (
        <View key={subjectId} style={styles.group}>
          <Pressable
            onPress={() => start({ subjectId }, group.name)}
            style={[styles.row, styles.subject]}
          >
            <Text style={styles.rowText}>{group.name}</Text>
            <Text style={styles.count}>{group.items}</Text>
          </Pressable>
          {group.decks.map((deck) => (
            <Pressable
              key={deck.id}
              disabled={!deck.items}
              onPress={() => start({ deckId: deck.id }, deck.name)}
              style={[styles.row, styles.deck, !deck.items && styles.dimmed]}
            >
              <Text style={styles.deckText}>{deck.name}</Text>
              <Text style={styles.count}>{deck.items}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      {!decks.length && (
        <Text style={styles.sub}>
          Nothing imported yet. Go to Import to paste NotebookLM JSON first.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 10, backgroundColor: "#FFF9F2", flexGrow: 1 },
  title: { fontSize: 27, fontWeight: "800", color: "#3E2B23" },
  help: { color: "#6C564D", marginBottom: 6, lineHeight: 21 },
  group: { gap: 6 },
  row: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headline: { backgroundColor: "#D96642" },
  subject: { borderWidth: 1, borderColor: "#E9875C" },
  deck: { paddingLeft: 28 },
  rowText: { color: "#3E2B23", fontSize: 17, fontWeight: "800" },
  deckText: { color: "#55423A", fontSize: 16, fontWeight: "600" },
  inverseText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  inverseCount: { color: "#FFE9BC", fontWeight: "800" },
  count: { color: "#6C564D", fontWeight: "700" },
  dimmed: { opacity: 0.45 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "#FFF9F2",
  },
  done: { fontSize: 22, fontWeight: "800", color: "#3E2B23" },
  sub: { color: "#6C564D", textAlign: "center", lineHeight: 21 },
  action: {
    backgroundColor: "#D96642",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  actionText: { color: "#FFF", fontWeight: "800" },
});
