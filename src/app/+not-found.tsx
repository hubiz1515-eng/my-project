import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { resetTo } from '../utils/nav';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🧭</Text>
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.sub}>주소가 바뀌었거나 없는 화면이에요.</Text>
      <Pressable onPress={() => resetTo('/')} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>홈으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, backgroundColor: colors.background },
  emoji: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textMuted },
  btn: { marginTop: 12, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '800' },
});
