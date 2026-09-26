import { formatMinute } from "@/utils/format";
import type { LaundryReminder, QuietHours } from "@/database/types";
import {
  getLaundryReminder,
  getQuietHours,
  setLaundryReminder,
} from "@/services/notificationService";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

const OFF: LaundryReminder = {
  is_active: 0,
  started_at: null,
  honor_quiet_hours: 0,
};

// Soaking clothes get nagged about every half hour, and whether that runs
// through the night is the one choice she makes when arming it.
export function LaundryToggle({
  style,
  textStyle,
}: {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const db = useSQLiteContext();
  const [reminder, setReminder] = useState<LaundryReminder>(OFF);
  const [quiet, setQuiet] = useState<QuietHours | null>(null);

  useEffect(() => {
    void Promise.all([getLaundryReminder(db), getQuietHours(db)]).then(
      ([laundry, hours]) => {
        setReminder(laundry);
        setQuiet(hours);
      },
    );
  }, [db]);

  const commit = async (active: boolean, honorQuietHours: boolean) => {
    try {
      setReminder(await setLaundryReminder(db, active, honorQuietHours));
    } catch (reason) {
      console.error("Failed to toggle the laundry reminder", reason);
    }
  };

  const arm = () => {
    const window = quiet?.enabled
      ? `Pippo goes quiet between ${formatMinute(quiet.startMinute)} and ${formatMinute(quiet.endMinute)}.`
      : "Quiet hours are off right now.";
    Alert.alert("How often should Pippo nag?", window, [
      { text: "Cancel", style: "cancel" },
      {
        text: "All night too",
        onPress: () => void commit(true, false),
      },
      {
        text: "Only my waking hours",
        onPress: () => void commit(true, true),
      },
    ]);
  };

  return (
    <Pressable
      onPress={() => (reminder.is_active ? void commit(false, false) : arm())}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <Text style={textStyle}>
        🧺{" "}
        {reminder.is_active
          ? `CLOTHES ARE SOAKING${reminder.honor_quiet_hours === 1 ? " · daytime only" : " · nagging all night"}`
          : "I PUT MY CLOTHES TO SOAK"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
