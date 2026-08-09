import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getSubjects } from '@/database/queries/study';
import type { Subject } from '@/database/types';

export default function StudySubjectsScreen() {
  const db = useSQLiteContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  useFocusEffect(useCallback(() => { void getSubjects(db).then(setSubjects); }, [db]));
  return <View style={styles.screen}><Text style={styles.title}>Choose a subject</Text>{subjects.length === 0 ? <Text style={styles.empty}>Import some flashcards or MCQs to begin studying.</Text> : subjects.map((subject) => <Link key={subject.id} href={{ pathname: '/study/decks', params: { subjectId: subject.id, subjectName: subject.name } }} asChild><Pressable style={styles.row}><Text style={styles.rowText}>{subject.name}</Text><Text>›</Text></Pressable></Link>)}</View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, backgroundColor: '#FFF9F2', gap: 12 }, title: { fontSize: 26, fontWeight: '800', color: '#3E2B23', marginBottom: 8 }, empty: { color: '#6C564D', fontSize: 16, lineHeight: 24 }, row: { backgroundColor: '#FFF', padding: 18, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between' }, rowText: { fontSize: 17, fontWeight: '600', color: '#3E2B23' } });
