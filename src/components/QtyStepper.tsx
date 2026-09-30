import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';

export function QtyStepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** 접근성 라벨 접두어 (예: 상품명) */
  label: string;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={[styles.btn, value <= min && styles.disabled]}
        hitSlop={6}
        accessibilityLabel={`${label} 수량 감소`}
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={[styles.btn, value >= max && styles.disabled]}
        hitSlop={6}
        accessibilityLabel={`${label} 수량 증가`}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  btnText: { fontSize: 18, fontWeight: '800', color: colors.text },
  value: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
});
