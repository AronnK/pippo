import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getDecks, getSubjects } from "@/database/queries/study";
import type { Deck, Subject } from "@/database/types";
import {
  importPreview,
  validateNotebookLmJson,
  type ImportKind,
  type ImportPreview,
} from "@/services/jsonImporter";

export default function JsonImportScreen() {
  const { kind = "flashcards", prefillSubject } = useLocalSearchParams<{
    kind?: ImportKind;
    prefillSubject?: string;
  }>();
  const db = useSQLiteContext();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);

  const [subjectName, setSubjectName] = useState(prefillSubject || "General");
  const [deckName, setDeckName] = useState("General");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getSubjects(db).then((rows) => {
        setSubjects(rows);
        // A prefilled subject means she came from that subject's own screens,
        // so its decks are already the ones she wants to pick from.
        const prefilled =
          prefillSubject &&
          rows.find(
            (row) => row.name.toLowerCase() === prefillSubject.toLowerCase(),
          );
        if (!prefilled) return;
        setSelectedSubjectId(prefilled.id);
        void getDecks(db, prefilled.id).then(setDecks);
      });
    }, [db, prefillSubject]),
  );

  const selectSubject = async (subject: Subject) => {
    setSelectedSubjectId(subject.id);
    setSubjectName(subject.name);
    setDeckName("");
    setDecks(await getDecks(db, subject.id));
  };

  const validate = () => {
    try {
      // The importer will now accept the exact schema from your prompts
      const next = validateNotebookLmJson(raw, kind);
      setPreview(next);
      // Only override the subject name if NotebookLM actually provided one AND we didn't pass a strict prefill
      if (next.subject && !prefillSubject) {
        setSubjectName(next.subject);
      }
      setError(null);
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not validate that JSON.",
      );
    }
  };

  const submit = async () => {
    if (!preview) return;
    try {
      setImporting(true);
      const result = await importPreview(db, preview, subjectName, deckName);
      router.replace({
        pathname: "/study/decks",
        params: { subjectId: result.subjectId, subjectName },
      });
    } catch (reason) {
      Alert.alert(
        "Import failed",
        reason instanceof Error
          ? reason.message
          : "Please check the selected subject and deck.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>
        {kind === "flashcards" ? "Flashcards" : "MCQs"} JSON
      </Text>
      <Text style={styles.help}>Paste NotebookLM’s JSON response.</Text>

      <TextInput
        value={raw}
        onChangeText={(text) => {
          setRaw(text);
          setPreview(null);
        }}
        style={styles.input}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="[ { ... } ]"
      />

      <Pressable onPress={validate} style={styles.validate}>
        <Text style={styles.validateText}>Validate JSON</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {preview && (
        <View style={styles.summary}>
          <Text style={styles.valid}>
            ✓ Valid JSON, {preview.items.length}{" "}
            {kind === "flashcards" ? "flashcards" : "MCQs"} found.
          </Text>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            value={subjectName}
            onChangeText={(value) => {
              setSubjectName(value);
              setSelectedSubjectId(null);
            }}
            style={styles.smallInput}
            placeholder="Subject name"
          />

          {subjects.length > 0 && !prefillSubject && (
            <View style={styles.chips}>
              {subjects.map((subject) => (
                <Pressable
                  key={subject.id}
                  onPress={() => void selectSubject(subject)}
                  style={[
                    styles.chip,
                    selectedSubjectId === subject.id && styles.chipSelected,
                  ]}
                >
                  <Text>{subject.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Deck</Text>
          <TextInput
            value={deckName}
            onChangeText={setDeckName}
            style={styles.smallInput}
            placeholder="Deck name (e.g. Chapter 1)"
          />

          {decks.length > 0 && (
            <View style={styles.chips}>
              {decks.map((deck) => (
                <Pressable
                  key={deck.id}
                  onPress={() => setDeckName(deck.name)}
                  style={[
                    styles.chip,
                    deckName === deck.name && styles.chipSelected,
                  ]}
                >
                  <Text>{deck.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            disabled={importing || !subjectName.trim() || !deckName.trim()}
            onPress={() => void submit()}
            style={[
              styles.import,
              (!subjectName.trim() || !deckName.trim()) && styles.disabled,
            ]}
          >
            <Text style={styles.importText}>
              {importing
                ? "Importing…"
                : `Import ${preview.items.length} items`}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 12, backgroundColor: "#FFF9F2", flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "800", color: "#3E2B23" },
  help: { color: "#6C564D", lineHeight: 21 },
  input: {
    minHeight: 230,
    borderWidth: 1,
    borderColor: "#E7D5C9",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFF",
    fontSize: 15,
  },
  validate: {
    backgroundColor: "#D96642",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
  },
  validateText: { color: "#FFF", fontWeight: "700" },
  error: { color: "#B42318", lineHeight: 21 },
  summary: { paddingTop: 8, gap: 10 },
  valid: { color: "#267942", fontWeight: "700", fontSize: 16 },
  label: { fontWeight: "800", color: "#3E2B23", marginTop: 4 },
  smallInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E7D5C9",
    padding: 13,
    borderRadius: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#E7D5C9",
    backgroundColor: "#FFF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  chipSelected: { borderColor: "#D96642", backgroundColor: "#FBE4D9" },
  import: {
    backgroundColor: "#2E8B57",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 6,
  },
  disabled: { opacity: 0.45 },
  importText: { color: "#FFF", fontWeight: "800" },
});
