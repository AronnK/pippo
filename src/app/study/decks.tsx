import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getDecks } from '@/database/queries/study';
import type { Deck } from '@/database/types';

export default function DecksScreen() {
  const { subjectId, subjectName } = useLocalSearchParams<{ subjectId: string; subjectName: string }>();
  const db = useSQLiteContext(); const [decks, setDecks] = useState<Deck[]>([]); const id = Number(subjectId);
  useFocusEffect(useCallback(() => { if (Number.isFinite(id)) void getDecks(db, id).then(setDecks); }, [db, id]));
  return <View style={styles.screen}><Text style={styles.title}>{subjectName || 'Decks'}</Text>{decks.map((deck) => <View key={deck.id} style={styles.card}><Text style={styles.deck}>{deck.name}</Text><View style={styles.buttons}><Link href={{ pathname: '/study/flashcards', params: { deckId: deck.id, deckName: deck.name } }} asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>Flashcards</Text></Pressable></Link><Link href={{ pathname: '/study/mcqs', params: { deckId: deck.id, deckName: deck.name } }} asChild><Pressable style={styles.secondary}><Text style={styles.secondaryText}>MCQs</Text></Pressable></Link></View></View>)}</View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, gap: 12, backgroundColor: '#FFF9F2' }, title: { fontSize: 26, fontWeight: '800', color: '#3E2B23', marginBottom: 8 }, card: { padding: 18, borderRadius: 14, backgroundColor: '#FFF', gap: 14 }, deck: { fontSize: 18, fontWeight: '700', color: '#3E2B23' }, buttons: { flexDirection: 'row', gap: 10 }, primary: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#D96642' }, primaryText: { color: '#FFF', fontWeight: '700' }, secondary: { flex: 1, alignItems: 'center', padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#D96642' }, secondaryText: { color: '#9E452C', fontWeight: '700' } });
