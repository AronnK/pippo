import { Link, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { clearAllData } from "@/services/backupService";

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const reset = async () => {
    await clearAllData(db);
    router.replace("/");
  };

  const confirmReset = () =>
    Alert.alert(
      "Reset everything?",
      "Pippo forgets every subject, card, streak, freeze and statistic. Export a backup first if you might want any of it back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, wipe it",
          style: "destructive",
          onPress: () => void reset(),
        },
      ],
    );

  const item = (title: string, href: string, description: string) => (
    <Link href={href} asChild>
      <Pressable style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </Pressable>
    </Link>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {item(
        "Notifications",
        "/settings/notifications",
        "Which reminders Pippo sends, and when.",
      )}
      {item(
        "Backup & restore",
        "/settings/backup",
        "Save everything to a file you keep, or load one back in.",
      )}
      <Pressable onPress={confirmReset} style={styles.danger}>
        <Text style={styles.dangerTitle}>Reset Pippo</Text>
        <Text style={styles.dangerText}>
          Delete all study data from this phone.
        </Text>
      </Pressable>
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 20,
    gap: 12,
    backgroundColor: "#FFF9F2",
  },
  row: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E7D5C9",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#3E2B23" },
  description: { color: "#6C564D", fontSize: 14, lineHeight: 20 },
  danger: {
    backgroundColor: "#FCEAE8",
    borderRadius: 14,
    padding: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E3B8B4",
  },
  dangerTitle: { fontSize: 18, fontWeight: "800", color: "#A43E39" },
  dangerText: { color: "#8C5350", fontSize: 14 },
  footer: { height: 40 },
});
