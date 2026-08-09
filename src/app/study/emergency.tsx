import { MixedStudySession } from "@/components/MixedStudySession";
import { selectSurpriseItems } from "@/database/queries/quality";
import type { StudyItem } from "@/database/types";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
export default function EmergencyScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    void selectSurpriseItems(db, 5, true).then(setItems);
  }, [db]);
  return (
    <View style={{ flex: 1 }}>
      {remaining !== null ? (
        <Text style={{ padding: 24, fontSize: 20, fontWeight: "700" }}>
          Good start. Now finish the remaining {remaining}.
        </Text>
      ) : (
        <MixedStudySession
          db={db}
          items={items}
          source="emergency"
          onDone={setRemaining}
        />
      )}
    </View>
  );
}
