import { MixedStudySession } from "@/components/MixedStudySession";
import { getWeakCounts, getWeakItems } from "@/database/queries/quality";
import type { StudyItem } from "@/database/types";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
export default function WeakScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [label, setLabel] = useState("Weak: 0 flashcards + 0 MCQs");
  const load = useCallback(() => {
    void Promise.all([getWeakItems(db), getWeakCounts(db)]).then(
      ([loaded, counts]) => {
        setItems(loaded);
        setLabel(`Weak: ${counts.cards} flashcards + ${counts.mcqs} MCQs`);
      },
    );
  }, [db]);
  useFocusEffect(load);
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>{label}</Text>
      <MixedStudySession
        db={db}
        items={items}
        reviewWeak
        source="weak_review"
        onDone={() => load()}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF9F2" },
  label: { padding: 16, fontWeight: "800", color: "#3E2B23" },
});
