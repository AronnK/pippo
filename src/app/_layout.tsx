import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense } from "react";
import { ActivityIndicator, View } from "react-native";

import { migrateDbIfNeeded } from "@/database/migrations";
import { DATABASE_NAME } from "@/database/schema";

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={migrateDbIfNeeded}
        useSuspense
      >
        <Stack
          screenOptions={{
            headerBackTitle: "Back",
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="study/index" options={{ title: "Study" }} />
          <Stack.Screen name="study/decks" options={{ title: "Decks" }} />
          <Stack.Screen
            name="study/flashcards"
            options={{ title: "Flashcards" }}
          />
          <Stack.Screen name="study/mcqs" options={{ title: "MCQs" }} />
          <Stack.Screen name="import/index" options={{ title: "Import" }} />
          <Stack.Screen
            name="import/flashcard-prompt"
            options={{ title: "Flashcard prompt" }}
          />
          <Stack.Screen
            name="import/mcq-prompt"
            options={{ title: "MCQ prompt" }}
          />
          <Stack.Screen
            name="import/json-import"
            options={{ title: "Import JSON" }}
          />
          <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
          <Stack.Screen
            name="settings/notifications"
            options={{ title: "Notification settings" }}
          />
          <Stack.Screen
            name="settings/backup"
            options={{ title: "Backup & restore" }}
          />
          <Stack.Screen name="progress/index" options={{ title: "Progress" }} />
          <Stack.Screen
            name="progress/statistics"
            options={{ title: "Statistics" }}
          />
          <Stack.Screen name="note" options={{ title: "A Note From Pippo" }} />
          <Stack.Screen name="timer" options={{ title: "Study Timer" }} />
          <Stack.Screen
            name="study/weak"
            options={{ title: "Review weak cards" }}
          />
          <Stack.Screen
            name="study/surprise"
            options={{ title: "Surprise Me" }}
          />
          <Stack.Screen
            name="study/random-quiz"
            options={{ title: "Random Quiz" }}
          />
          <Stack.Screen
            name="study/emergency"
            options={{ title: "Emergency 5" }}
          />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
