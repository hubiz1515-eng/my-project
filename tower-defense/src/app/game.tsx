import { useLocalSearchParams } from 'expo-router';
import { GameScreen } from '@/game/ui/GameScreen';

export default function GameRoute() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  return <GameScreen seed={seed ? Number(seed) : undefined} />;
}
