import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { PippoState } from '@/services/pippoState';

const images: Record<PippoState, number> = {
  neutral: require('@/assets/pippo/neutral.png'),
  slightly_sad: require('@/assets/pippo/slightly-sad.png'),
  sad: require('@/assets/pippo/sad.png'),
  angry: require('@/assets/pippo/angry.png'),
  happy: require('@/assets/pippo/happy.png'),
  very_happy: require('@/assets/pippo/very-happy.png'),
  celebration: require('@/assets/pippo/celebration.png'),
  pleading: require('@/assets/pippo/pleading.png'),
  dead: require('@/assets/pippo/dead.png'),
};

export function PippoCharacter({ state, size = 220 }: { state: PippoState; size?: number }) {
  return <View style={[styles.frame, { width: size, height: size }]}><Image source={images[state]} style={styles.image} contentFit="contain" accessibilityLabel={`Pippo is ${state.replace('_', ' ')}`} /></View>;
}
const styles = StyleSheet.create({ frame: { alignSelf: 'center' }, image: { width: '100%', height: '100%' } });
