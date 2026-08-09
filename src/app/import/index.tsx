import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ImportScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Bring in study material</Text><Text style={styles.subtitle}>Use NotebookLM to generate JSON, then paste it here.</Text><Link href="/import/flashcard-prompt" asChild><Pressable style={styles.card}><Text style={styles.cardTitle}>Generate Flashcards</Text><Text style={styles.cardText}>Copy the prompt for 50 flashcards.</Text></Pressable></Link><Link href="/import/mcq-prompt" asChild><Pressable style={styles.card}><Text style={styles.cardTitle}>Generate MCQs</Text><Text style={styles.cardText}>Copy the prompt for 30 multiple-choice questions.</Text></Pressable></Link></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, gap: 14, backgroundColor: '#FFF9F2' }, title: { fontSize: 27, fontWeight: '800', color: '#3E2B23' }, subtitle: { color: '#6C564D', marginBottom: 10, fontSize: 16 }, card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, gap: 8 }, cardTitle: { fontSize: 19, fontWeight: '800', color: '#3E2B23' }, cardText: { color: '#6C564D' } });
