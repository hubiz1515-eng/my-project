import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';

/** 지도를 띄울 수 없을 때 (키 없음·로드 실패). 목록은 그대로 사용 가능 */
export function MapUnavailable({ message }: { message: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16, backgroundColor: colors.mapBg },
  emoji: { fontSize: 28 },
  text: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
