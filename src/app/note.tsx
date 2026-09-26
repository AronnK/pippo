import { NOTE_FROM_PIPPO } from "@/constants/personalMessages";
import { PippoCharacter } from "@/components/PippoCharacter";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function NoteScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: "A Note From Pippo" }} />
      <PippoCharacter state="happy" size={180} />
      <View style={styles.letter}>
        {NOTE_FROM_PIPPO.split("\n\n").map((paragraph, index) => (
          <Text
            key={index}
            style={paragraph.startsWith("—") ? styles.sign : styles.paragraph}
          >
            {paragraph}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 18, backgroundColor: "#FFF9F2" },
  letter: {
    backgroundColor: "#FFF",
    padding: 22,
    borderRadius: 18,
    gap: 16,
  },
  paragraph: { fontSize: 16, lineHeight: 24, color: "#55423A" },
  sign: { fontSize: 16, lineHeight: 24, color: "#9E452C", fontWeight: "700" },
});
