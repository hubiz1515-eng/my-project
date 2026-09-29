import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

function checkFirebase(): string | null {
  try {
    // 환경변수가 없으면 firebaseConfig 가 명확한 에러를 던집니다.
    require('./src/config/firebaseConfig');
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export default function App() {
  const error = checkFirebase();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PickupDeal</Text>
      <Text style={error ? styles.error : styles.ok}>
        {error ?? 'Firebase 초기화 완료 ✅'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  ok: { color: '#15803d' },
  error: { color: '#b91c1c', textAlign: 'center' },
});
