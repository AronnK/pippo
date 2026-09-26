import { MixedStudySession } from "@/components/MixedStudySession";
import { DAILY_GOAL } from "@/constants/goals";
import { selectSurpriseItems } from "@/database/queries/quality";
import type { StudyItem } from "@/database/types";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { View } from "react-native";
export default function SurpriseScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<StudyItem[]>([]);
  useEffect(() => {
    void selectSurpriseItems(db, DAILY_GOAL).then(setItems);
  }, [db]);
  return (
    <View style={{ flex: 1 }}>
      <MixedStudySession db={db} items={items} />
    </View>
  );
}
