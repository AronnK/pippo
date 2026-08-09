import {
    getManualTimer,
    startSession,
    stopSession,
} from "@/services/studyTimeService";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
const format = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
export default function TimerScreen() {
  const db = useSQLiteContext();
  const [started, setStarted] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const load = useCallback(() => {
    void getManualTimer(db).then((row) => setStarted(row?.start_time ?? null));
  }, [db]);
  useFocusEffect(load);
  useEffect(() => {
    const id = setInterval(
      () =>
        setElapsed(
          started
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(started).getTime()) / 1000),
              )
            : 0,
        ),
      1000,
    );
    return () => clearInterval(id);
  }, [started]);
  const toggle = async () => {
    if (started) {
      await stopSession(db, "manual");
      setStarted(null);
    } else {
      await startSession(db, "manual");
      const row = await getManualTimer(db);
      setStarted(row?.start_time ?? null);
    }
  };
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Study Timer</Text>
      <Text style={styles.time}>{format(elapsed)}</Text>
      <Pressable onPress={() => void toggle()} style={styles.button}>
        <Text style={styles.buttonText}>
          {started ? "STOP TIMER" : "START TIMER"}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    backgroundColor: "#FFF9F2",
  },
  title: { fontSize: 28, fontWeight: "800" },
  time: { fontSize: 36, fontWeight: "700" },
  button: { backgroundColor: "#D96642", padding: 20, borderRadius: 14 },
  buttonText: { color: "#FFF", fontWeight: "800" },
});
