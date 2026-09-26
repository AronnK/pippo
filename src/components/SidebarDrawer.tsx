import { getSubjects } from "@/database/queries/study";
import { LaundryToggle } from "@/components/LaundryToggle";
import { Link, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function SidebarDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (visible && db) void getSubjects(db).then(setSubjects);
  }, [visible, db]);

  if (!db) return null;

  const item = (label: string, href: Href) => (
    <Link
      href={href}
      asChild
      key={typeof href === "string" ? href : href.pathname}
    >
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      >
        <Text>{label}</Text>
      </Pressable>
    </Link>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.drawer}>
        <ScrollView>
          <Text style={styles.title}>Pippo</Text>

          {item("Home", "/" as Href)}

          <Text style={styles.section}>STUDY</Text>
          {item("Continue Studying", "/study" as Href)}
          {item("Weak Cards", "/study/weak" as Href)}
          {item("Surprise Me", "/study/surprise" as Href)}
          {item("Random Quiz", "/study/random-quiz" as Href)}
          {item("Emergency 5", "/study/emergency" as Href)}

          <Text style={styles.section}>SUBJECTS</Text>
          {subjects.map((s) =>
            item(s.name, {
              pathname: "/study/decks",
              params: { subjectId: s.id, subjectName: s.name },
            } as Href),
          )}

          <Text style={styles.section}>TOOLS</Text>
          {item("Progress", "/progress" as Href)}
          {item("A Note From Pippo", "/note" as Href)}
          {item("Study Timer", "/timer" as Href)}

          <LaundryToggle style={styles.item} />

          {item("Settings", "/settings" as Href)}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.35)" },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "82%",
    maxWidth: 340,
    backgroundColor: "#FFF9F2",
    padding: 22,
  },
  title: { fontSize: 30, fontWeight: "800", marginBottom: 12 },
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A6758",
    marginTop: 18,
    marginBottom: 5,
  },
  item: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: "#EBDDD5",
  },
  pressed: { opacity: 0.6 },
});
