import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { ImportKind } from '@/services/jsonImporter';

export function PromptScreen({ prompt, kind }: { prompt: string; kind: ImportKind }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await Clipboard.setStringAsync(prompt); setCopied(true); };
  return <ScrollView contentContainerStyle={styles.screen}><Text style={styles.intro}>Paste this into NotebookLM after uploading the study sources.</Text><Text selectable style={styles.prompt}>{prompt}</Text><Pressable onPress={() => void copy()} style={styles.copy}><Text style={styles.copyText}>{copied ? 'Copied' : 'Copy prompt'}</Text></Pressable><Link href={{ pathname: '/import/json-import', params: { kind } }} asChild><Pressable style={styles.import}><Text style={styles.importText}>Paste NotebookLM JSON</Text></Pressable></Link></ScrollView>;
}
const styles = StyleSheet.create({ screen: { padding: 20, gap: 16, backgroundColor: '#FFF9F2', flexGrow: 1 }, intro: { color: '#6C564D', fontSize: 16, lineHeight: 23 }, prompt: { fontFamily: 'monospace', color: '#3E2B23', backgroundColor: '#FFF', padding: 16, borderRadius: 12, lineHeight: 20 }, copy: { borderWidth: 1, borderColor: '#D96642', padding: 15, borderRadius: 12, alignItems: 'center' }, copyText: { color: '#9E452C', fontWeight: '700' }, import: { backgroundColor: '#D96642', padding: 16, borderRadius: 12, alignItems: 'center' }, importText: { color: '#FFF', fontWeight: '700' } });
