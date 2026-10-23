import { useState } from 'react';
import { Animated } from 'react-native';

/** react-native-web 에는 RN 의 useAnimatedValue 가 없어서 직접 만든 동일 기능의 훅 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [v] = useState(() => new Animated.Value(initial));
  return v;
}
