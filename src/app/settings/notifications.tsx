import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { DAILY_GOAL } from "@/constants/goals";
import type {
  NotificationCategory,
  NotificationSetting,
  QuietHours,
} from "@/database/types";
import {
  getNotificationSettings,
  getQuietHours,
  setNotificationEnabled,
  setQuietHours,
} from "@/services/notificationService";
import { formatMinute } from "@/utils/format";

const labels: Record<NotificationCategory, string> = {
  hydration: "Hydration",
  sleep: "Sleep",
  study: "Study / don’t use phone",
  miss_you: "Miss You",
  laundry: "Laundry",
  keep_calm: "Keep Calm",
  weak_review: "Weak Cards Review",
};

const order: NotificationCategory[] = [
  "study",
  "hydration",
  "sleep",
  "weak_review",
  "keep_calm",
  "miss_you",
  "laundry",
];

const STEP_MINUTES = 30;
const DAY_MINUTES = 1440;

const step = (minute: number, direction: number) =>
  (minute + direction * STEP_MINUTES + DAY_MINUTES) % DAY_MINUTES;

export default function NotificationSettingsScreen() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [saved, setSaved] = useState<QuietHours | null>(null);
  const [draft, setDraft] = useState<QuietHours | null>(null);

  const load = useCallback(() => {
    void getNotificationSettings(db).then((rows) =>
      setSettings(
        [...rows].sort(
          (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
        ),
      ),
    );
    void getQuietHours(db).then((quiet) => {
      setSaved(quiet);
      setDraft(quiet);
    });
  }, [db]);

  useFocusEffect(load);

  const toggle = async (category: NotificationCategory, enabled: boolean) => {
    await setNotificationEnabled(db, category, enabled);
    load();
  };

  const dirty =
    draft &&
    saved &&
    (draft.enabled !== saved.enabled ||
      draft.startMinute !== saved.startMinute ||
      draft.endMinute !== saved.endMinute);

  const save = async () => {
    if (!draft) return;
    setSaved(await setQuietHours(db, draft));
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.help}>
        Choose which Pippo reminders you want. The study nudge fires about three
        hours after you open the app, and stops once you’ve hit {DAILY_GOAL}{" "}
        items for the day.
      </Text>
      {settings.map((setting) => (
        <View key={setting.category} style={styles.row}>
          <Text style={styles.label}>{labels[setting.category]}</Text>
          <Switch
            value={Boolean(setting.is_enabled)}
            onValueChange={(enabled) => void toggle(setting.category, enabled)}
          />
        </View>
      ))}

      {draft && (
        <View style={styles.quiet}>
          <Text style={styles.section}>Quiet hours</Text>
          <View style={styles.quietRow}>
            <Text style={styles.label}>Enabled</Text>
            <Switch
              value={draft.enabled}
              onValueChange={(enabled) => setDraft({ ...draft, enabled })}
            />
          </View>
          <TimeStepper
            disabled={!draft.enabled}
            label="Starts"
            minute={draft.startMinute}
            onChange={(startMinute) => setDraft({ ...draft, startMinute })}
          />
          <TimeStepper
            disabled={!draft.enabled}
            label="Ends"
            minute={draft.endMinute}
            onChange={(endMinute) => setDraft({ ...draft, endMinute })}
          />
          <Text style={styles.quietHelp}>
            Pippo holds every reminder until {formatMinute(draft.endMinute)},
            except the sleep reminders and a laundry timer set to run all night.
          </Text>
          <Pressable
            disabled={!dirty}
            onPress={() => void save()}
            style={[styles.save, !dirty && styles.saveIdle]}
          >
            <Text style={styles.saveText}>
              {dirty ? "Save quiet hours" : "Saved"}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function TimeStepper({
  disabled,
  label,
  minute,
  onChange,
}: {
  disabled: boolean;
  label: string;
  minute: number;
  onChange: (minute: number) => void;
}) {
  return (
    <View style={[styles.quietRow, disabled && styles.disabled]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          disabled={disabled}
          onPress={() => onChange(step(minute, -1))}
          style={styles.arrow}
        >
          <Text style={styles.arrowText}>−</Text>
        </Pressable>
        <Text style={styles.time}>{formatMinute(minute)}</Text>
        <Pressable
          disabled={disabled}
          onPress={() => onChange(step(minute, 1))}
          style={styles.arrow}
        >
          <Text style={styles.arrowText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: "#FFF9F2" },
  title: { fontSize: 27, fontWeight: "800", color: "#3E2B23" },
  help: { color: "#6C564D", lineHeight: 21, marginBottom: 8 },
  section: {
    fontSize: 19,
    fontWeight: "800",
    color: "#3E2B23",
    marginBottom: 4,
  },
  row: {
    backgroundColor: "#FFF",
    padding: 17,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quiet: {
    backgroundColor: "#FFF",
    padding: 17,
    borderRadius: 14,
    gap: 10,
    marginTop: 10,
  },
  quietRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quietHelp: { color: "#6C564D", fontSize: 13, lineHeight: 19 },
  disabled: { opacity: 0.45 },
  label: { color: "#3E2B23", fontSize: 17, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E4D6",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#9E452C", fontSize: 20, fontWeight: "800" },
  time: {
    color: "#3E2B23",
    fontSize: 17,
    fontWeight: "700",
    minWidth: 86,
    textAlign: "center",
  },
  save: {
    backgroundColor: "#D96642",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveIdle: { backgroundColor: "#E7D8CB" },
  saveText: { color: "#FFF", fontWeight: "800" },
});
