import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  IDLE_TIMEOUT_MS,
  startSession,
  stopSession,
} from "@/services/studyTimeService";

const IDLE_CHECK_MS = 15_000;

// Spec 4.7: automatic tracking only counts time she spends answering. An
// untouched screen stops the session after IDLE_TIMEOUT_MS and the next tap
// opens a fresh one, so a phone left on a card adds no time. Callers wire
// noteActivity to their press handlers.
export function useStudyTracking(
  source: string,
  subjectId?: number,
  deckId?: number,
) {
  const db = useSQLiteContext();
  // Stamped by resume() rather than during render; 0 means "no session opened yet".
  const lastActivity = useRef(0);
  const focused = useRef(false);
  const stopped = useRef(false);

  const resume = useCallback(() => {
    lastActivity.current = Date.now();
    stopped.current = false;
    void startSession(db, source, subjectId, deckId);
  }, [db, source, subjectId, deckId]);

  const pause = useCallback(() => {
    if (stopped.current) return;
    stopped.current = true;
    void stopSession(db, source);
  }, [db, source]);

  const noteActivity = useCallback(() => {
    if (stopped.current) resume();
    else lastActivity.current = Date.now();
  }, [resume]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      resume();
      return () => {
        focused.current = false;
        pause();
      };
    }, [resume, pause]),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      if (!focused.current || stopped.current) return;
      if (Date.now() - lastActivity.current >= IDLE_TIMEOUT_MS) pause();
    }, IDLE_CHECK_MS);
    // Screens still mounted below the focused one must not reopen their
    // session just because the app came back to the foreground.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (focused.current) resume();
      } else pause();
    });
    return () => {
      clearInterval(tick);
      subscription.remove();
    };
  }, [pause, resume]);

  return { noteActivity };
}
