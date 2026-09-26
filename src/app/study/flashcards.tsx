import { Link, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DAILY_GOAL } from "@/constants/goals";
import { markFlashcard } from "@/database/queries/quality";
import {
  getFlashcards,
  getTodayStats,
  recordCompletedItem,
} from "@/database/queries/study";
import type { Flashcard } from "@/database/types";
import { useStudyTracking } from "@/hooks/use-study-tracking";
import { completeTodayIfEligible } from "@/services/streakService";

export default function FlashcardsScreen() {
  const { deckId, deckName } = useLocalSearchParams<{
    deckId: string;
    deckName: string;
  }>();
  const db = useSQLiteContext();
  const id = Number(deckId);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  useStudyTracking("deck_flashcards", undefined, id);
  useEffect(() => {
    void Promise.all([getFlashcards(db, id), getTodayStats(db)]).then(
      ([loadedCards, stats]) => {
        setCards(loadedCards);
        setCount(stats.items_completed);
        setLoaded(true);
      },
    );
  }, [db, id]);
  const answer = async (knewIt: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await markFlashcard(db, card.id, knewIt);
      await recordCompletedItem(db, "flashcard");
      await completeTodayIfEligible(db);
      const stats = await getTodayStats(db);
      setCount(stats.items_completed);
      setRevealed(false);
      setIndex((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  };
  if (!loaded)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  if (!cards.length)
    return (
      <View style={styles.center}>
        <Text style={styles.done}>Nothing here yet.</Text>
        <Text>
          This deck has no flashcards. Import some JSON, or pick another deck.
        </Text>
        <Link href="/study" asChild>
          <Pressable style={styles.reveal}>
            <Text style={styles.revealText}>Back to subjects</Text>
          </Pressable>
        </Link>
      </View>
    );
  if (index >= cards.length)
    return (
      <View style={styles.center}>
        <Text style={styles.done}>Nice work.</Text>
        <Text>You completed all {cards.length} flashcards in this deck.</Text>
        <Text style={styles.count}>
          {count} / {DAILY_GOAL} items today
        </Text>
      </View>
    );
  const card = cards[index];
  return (
    <View style={styles.screen}>
      <Text style={styles.deck}>{deckName}</Text>
      <Text style={styles.count}>
        {count} / {DAILY_GOAL} items today · {index + 1} / {cards.length}
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>QUESTION</Text>
        <Text style={styles.question}>{card.question}</Text>
        {revealed && (
          <>
            <Text style={styles.label}>ANSWER</Text>
            <Text style={styles.answer}>{card.answer}</Text>
          </>
        )}
      </View>
      {revealed ? (
        <>
          <Text style={styles.label}>Did you know this?</Text>
          <View style={styles.answers}>
            <Pressable
              disabled={submitting}
              onPress={() => void answer(false)}
              style={styles.no}
            >
              <Text style={styles.noText}>NO</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={() => void answer(true)}
              style={styles.yes}
            >
              <Text style={styles.yesText}>YES</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={() => setRevealed(true)} style={styles.reveal}>
          <Text style={styles.revealText}>Show answer</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16, backgroundColor: "#FFF9F2" },
  center: {
    flex: 1,
    gap: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  deck: { color: "#6C564D", fontWeight: "600" },
  count: { color: "#6C564D" },
  card: {
    flex: 1,
    minHeight: 300,
    padding: 24,
    backgroundColor: "#FFF",
    borderRadius: 20,
    gap: 14,
  },
  label: {
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: "800",
    color: "#B07863",
  },
  question: { fontSize: 25, fontWeight: "700", color: "#3E2B23" },
  answer: { fontSize: 19, color: "#55423A", lineHeight: 28 },
  reveal: {
    alignItems: "center",
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#D96642",
  },
  revealText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  answers: { flexDirection: "row", gap: 12 },
  no: {
    flex: 1,
    alignItems: "center",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D96642",
  },
  yes: {
    flex: 1,
    alignItems: "center",
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#D96642",
  },
  noText: { color: "#9E452C", fontWeight: "700" },
  yesText: { color: "#FFF", fontWeight: "700" },
  done: { fontSize: 28, fontWeight: "800", color: "#3E2B23" },
});
