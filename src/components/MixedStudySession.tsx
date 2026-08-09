import type { SQLiteDatabase } from "expo-sqlite";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { markFlashcard, markMcq } from "@/database/queries/quality";
import { getTodayStats, recordCompletedItem } from "@/database/queries/study";
import type { StudyItem } from "@/database/types";
import { useStudyTracking } from "@/hooks/use-study-tracking";
import { completeTodayIfEligible } from "@/services/streakService";

export function MixedStudySession({
  db,
  items,
  onDone,
  reviewWeak = false,
  source = "surprise",
}: {
  db: SQLiteDatabase;
  items: StudyItem[];
  onDone?: (remaining: number) => void;
  reviewWeak?: boolean;
  source?: string;
}) {
  useStudyTracking(source);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const advance = async (item: StudyItem, outcome: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (item.kind === "flashcard") await markFlashcard(db, item.id, outcome);
      else await markMcq(db, item.id, outcome);
      await recordCompletedItem(db, item.kind);
      await completeTodayIfEligible(db);
      const stats = await getTodayStats(db);
      setIndex((value) => value + 1);
      setRevealed(false);
      setSelected(null);
      if (index + 1 >= items.length)
        onDone?.(Math.max(0, 50 - stats.items_completed));
    } finally {
      setBusy(false);
    }
  };
  if (!items.length)
    return (
      <View style={styles.center}>
        <Text style={styles.done}>You’re all caught up! 🎉</Text>
      </View>
    );
  if (index >= items.length)
    return (
      <View style={styles.center}>
        <Text style={styles.done}>Nice work!</Text>
      </View>
    );
  const item = items[index];
  if (item.kind === "flashcard")
    return (
      <View style={styles.screen}>
        <Text style={styles.count}>
          {index + 1} / {items.length}
        </Text>
        <View style={styles.card}>
          <Text style={styles.question}>{item.question}</Text>
          {revealed && <Text style={styles.answer}>{item.answer}</Text>}
        </View>
        {revealed ? (
          <>
            <Text style={styles.ask}>Did you know this?</Text>
            <View style={styles.row}>
              <Pressable
                disabled={busy}
                onPress={() => void advance(item, true)}
                style={styles.yes}
              >
                <Text style={styles.yesText}>YES</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void advance(item, false)}
                style={styles.no}
              >
                <Text style={styles.noText}>NO</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={() => setRevealed(true)} style={styles.action}>
            <Text style={styles.actionText}>Show answer</Text>
          </Pressable>
        )}
      </View>
    );
  const options = JSON.parse(item.options_json) as string[];
  const correct = selected === item.correct_answer_index;
  return (
    <View style={styles.screen}>
      <Text style={styles.count}>
        {index + 1} / {items.length}
      </Text>
      <Text style={styles.question}>{item.question}</Text>
      {options.map((option, optionIndex) => (
        <Pressable
          key={optionIndex}
          disabled={selected !== null}
          onPress={() => setSelected(optionIndex)}
          style={styles.option}
        >
          <Text>
            {String.fromCharCode(65 + optionIndex)}. {option}
          </Text>
        </Pressable>
      ))}
      {selected !== null && (
        <View style={styles.card}>
          <Text style={styles.ask}>{correct ? "Correct!" : "Not quite."}</Text>
          <Text>{item.explanation}</Text>
          <Pressable
            disabled={busy}
            onPress={() => void advance(item, correct)}
            style={styles.action}
          >
            <Text style={styles.actionText}>Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF9F2", padding: 20, gap: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  count: { color: "#6C564D" },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, gap: 15 },
  question: { fontSize: 23, color: "#3E2B23", fontWeight: "800" },
  answer: { fontSize: 18, color: "#55423A" },
  ask: {
    fontSize: 17,
    fontWeight: "800",
    color: "#3E2B23",
    textAlign: "center",
  },
  row: { flexDirection: "row", gap: 12 },
  yes: {
    flex: 1,
    backgroundColor: "#2E8B57",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  no: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D96642",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  yesText: { color: "#FFF", fontWeight: "800" },
  noText: { color: "#9E452C", fontWeight: "800" },
  action: {
    backgroundColor: "#D96642",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  actionText: { color: "#FFF", fontWeight: "800" },
  option: { backgroundColor: "#FFF", padding: 16, borderRadius: 12 },
  done: { fontSize: 23, fontWeight: "800", color: "#3E2B23" },
});
