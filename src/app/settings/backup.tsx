import { File } from "expo-file-system";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  backupSummary,
  exportBackup,
  parseBackup,
  restoreBackup,
  type BackupPayload,
} from "@/services/backupService";

export default function BackupScreen() {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pending, setPending] = useState<BackupPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      setStatus(await action());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  const exportNow = () => run(() => exportBackup(db));

  const review = (payload: BackupPayload) => {
    setPending(payload);
    setError(null);
  };

  const readFailure = (reason: unknown) =>
    setError(
      reason instanceof Error
        ? reason.message
        : "That backup could not be read.",
    );

  const pickFile = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ["application/json"] });
      if (picked.canceled) return;
      review(parseBackup(await picked.result.text()));
    } catch (reason) {
      readFailure(reason);
    }
  };

  const pasteFile = () => {
    try {
      review(parseBackup(raw));
    } catch (reason) {
      readFailure(reason);
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    const summary = backupSummary(pending);
    Alert.alert(
      "Replace everything on this phone?",
      `Pippo will forget what is here now and load ${summary.cards} flashcards, ${summary.mcqs} MCQs and ${summary.studyDays} study days from the backup instead. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore backup",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              const rows = await restoreBackup(db, pending);
              setPending(null);
              setRaw("");
              setShowPaste(false);
              router.replace("/");
              return `Restored ${rows} rows.`;
            }),
        },
      ],
    );
  };

  const summary = pending ? backupSummary(pending) : null;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.blurb}>
        A backup is one plain file with everything in it: your subjects, cards,
        streak, freezes, statistics and settings. Where it goes after that is
        up to you, Pippo never uploads anything.
      </Text>

      <View style={styles.card}>
        <Text style={styles.title}>Export a backup</Text>
        <Text style={styles.help}>
          Saves today&apos;s data and opens the Android share sheet so you can
          keep the file in Drive, Email, Files or anywhere else you like.
        </Text>
        <Pressable
          disabled={busy}
          onPress={() => void exportNow()}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            {busy ? "Working…" : "Export and share"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Restore a backup</Text>
        <Text style={styles.help}>
          Loads a file you exported earlier. It replaces everything currently on
          this phone, and you will be asked to confirm before it happens.
        </Text>
        <Pressable
          disabled={busy}
          onPress={() => void pickFile()}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Choose a backup file</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowPaste((value) => !value)}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>
            {showPaste
              ? "Hide the paste box"
              : "Or if the file picker fails, paste the backup text"}
          </Text>
        </Pressable>
        {showPaste && (
          <>
            <TextInput
              value={raw}
              onChangeText={setRaw}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste the whole contents of a pippo_backup file"
              style={styles.input}
            />
            <Pressable
              disabled={busy || !raw.trim()}
              onPress={pasteFile}
              style={[styles.primary, !raw.trim() && styles.disabled]}
            >
              <Text style={styles.primaryText}>Check this text</Text>
            </Pressable>
          </>
        )}
      </View>

      {summary && (
        <View style={styles.card}>
          <Text style={styles.title}>This backup holds</Text>
          <Text style={styles.line}>
            {summary.subjects} subjects · {summary.decks} decks
          </Text>
          <Text style={styles.line}>
            {summary.cards} flashcards · {summary.mcqs} MCQs
          </Text>
          <Text style={styles.line}>{summary.studyDays} days of statistics</Text>
          <Text style={styles.line}>Streak of {summary.streak} days</Text>
          <Pressable
            disabled={busy}
            onPress={confirmRestore}
            style={styles.dangerButton}
          >
            <Text style={styles.dangerText}>Restore and replace</Text>
          </Pressable>
        </View>
      )}

      {busy && !pending && <ActivityIndicator />}
      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 20,
    gap: 14,
    backgroundColor: "#FFF9F2",
  },
  blurb: { color: "#6C564D", fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E7D5C9",
  },
  title: { fontSize: 19, fontWeight: "800", color: "#3E2B23" },
  help: { color: "#6C564D", fontSize: 14, lineHeight: 21 },
  line: { color: "#55423A" },
  primary: {
    backgroundColor: "#D96642",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
  },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: "#D96642",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
  },
  secondaryText: { color: "#9E452C", fontWeight: "700" },
  dangerButton: {
    backgroundColor: "#A43E39",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
  },
  dangerText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  input: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#E7D5C9",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFF9F2",
    fontSize: 14,
  },
  disabled: { opacity: 0.45 },
  status: { color: "#267942", fontWeight: "700" },
  error: { color: "#B42318", lineHeight: 21 },
  footer: { height: 40 },
});
