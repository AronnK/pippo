import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getMcqs, getTodayStats, recordCompletedItem } from '@/database/queries/study';
import { markMcq } from '@/database/queries/quality';
import type { Mcq } from '@/database/types';
import { completeTodayIfEligible } from '@/services/streakService';

export default function McqsScreen() {
  const { deckId, deckName } = useLocalSearchParams<{ deckId: string; deckName: string }>();
  const db = useSQLiteContext(); const [questions, setQuestions] = useState<Mcq[]>([]); const [index, setIndex] = useState(0); const [selected, setSelected] = useState<number | null>(null); const [count, setCount] = useState(0);
  useEffect(() => { void Promise.all([getMcqs(db, Number(deckId)), getTodayStats(db)]).then(([loaded, stats]) => { setQuestions(loaded); setCount(stats.items_completed); }); }, [db, deckId]);
  const choose = async (choice: number) => { if (selected !== null) return; setSelected(choice); const current = questions[index]; const correct = choice === current.correct_answer_index; await markMcq(db, current.id, correct); await recordCompletedItem(db, 'mcq'); await completeTodayIfEligible(db); setCount((value) => value + 1); };
  const next = () => { setSelected(null); setIndex((value) => value + 1); };
  if (!questions.length) return <View style={styles.center}><ActivityIndicator /><Text>No MCQs in this deck yet.</Text></View>;
  if (index >= questions.length) return <View style={styles.center}><Text style={styles.done}>Quiz complete.</Text><Text>You completed all {questions.length} MCQs in this deck.</Text><Text style={styles.count}>{count} / 50 items today</Text></View>;
  const mcq = questions[index]; const options = JSON.parse(mcq.options_json) as string[]; const isCorrect = selected === mcq.correct_answer_index;
  return <View style={styles.screen}><Text style={styles.deck}>{deckName}</Text><Text style={styles.count}>{count} / 50 items today · {index + 1} / {questions.length}</Text><Text style={styles.question}>{mcq.question}</Text>{options.map((option, optionIndex) => <Pressable key={optionIndex} disabled={selected !== null} onPress={() => void choose(optionIndex)} style={[styles.option, selected !== null && optionIndex === mcq.correct_answer_index && styles.correct, selected === optionIndex && optionIndex !== mcq.correct_answer_index && styles.incorrect]}><Text style={styles.optionText}>{String.fromCharCode(65 + optionIndex)}. {option}</Text></Pressable>)}{selected !== null && <View style={styles.feedback}><Text style={styles.feedbackTitle}>{isCorrect ? 'Correct!' : 'Not quite.'}</Text><Text style={styles.explanation}>{mcq.explanation}</Text><Pressable onPress={next} style={styles.next}><Text style={styles.nextText}>Next question</Text></Pressable></View>}</View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, gap: 12, backgroundColor: '#FFF9F2' }, center: { flex: 1, gap: 14, padding: 24, alignItems: 'center', justifyContent: 'center' }, deck: { color: '#6C564D', fontWeight: '600' }, count: { color: '#6C564D' }, question: { fontSize: 23, fontWeight: '800', color: '#3E2B23', marginVertical: 12 }, option: { padding: 16, backgroundColor: '#FFF', borderRadius: 12 }, optionText: { fontSize: 16, color: '#3E2B23' }, correct: { backgroundColor: '#D9F3DF', borderWidth: 1, borderColor: '#4B9A60' }, incorrect: { backgroundColor: '#F9DCDC', borderWidth: 1, borderColor: '#C65B5B' }, feedback: { backgroundColor: '#FFF', borderRadius: 14, padding: 18, gap: 10, marginTop: 8 }, feedbackTitle: { fontSize: 19, fontWeight: '800', color: '#3E2B23' }, explanation: { color: '#55423A', lineHeight: 22 }, next: { backgroundColor: '#D96642', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 }, nextText: { color: '#FFF', fontWeight: '700' }, done: { fontSize: 28, fontWeight: '800', color: '#3E2B23' } });
