import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { PippoState } from '@/services/pippoState';

const images: Record<PippoState, number> = {
  neutral: require('@/assets/pippo/neutral.webp'),
  slightly_sad: require('@/assets/pippo/slightly-sad.webp'),
  sad: require('@/assets/pippo/sad.webp'),
  angry: require('@/assets/pippo/angry.webp'),
  happy: require('@/assets/pippo/happy.webp'),
  very_happy: require('@/assets/pippo/very-happy.webp'),
  celebration: require('@/assets/pippo/celebration.webp'),
  pleading: require('@/assets/pippo/pleading.webp'),
  dead: require('@/assets/pippo/dead.webp'),
};

export function PippoCharacter({ state, size = 220 }: { state: PippoState; size?: number }) {
  return <View style={[styles.frame, { width: size, height: size }]}><Image source={images[state]} style={styles.image} contentFit="contain" accessibilityLabel={`Pippo is ${state.replace('_', ' ')}`} /></View>;
}
const styles = StyleSheet.create({ frame: { alignSelf: 'center' }, image: { width: '100%', height: '100%' } });
