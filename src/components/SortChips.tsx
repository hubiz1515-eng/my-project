import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';

export type SortKey = 'distance' | 'discount' | 'deadline';

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: '가까운순' },
  { key: 'discount', label: '할인율순' },
  { key: 'deadline', label: '마감임박순' },
];

export function SortChips({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.text, active && styles.textActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  text: { fontSize: 13, color: colors.text },
  textActive: { color: '#fff', fontWeight: '700' },
});
