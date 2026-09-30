import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import type { UserRole } from '../../types/models';

const OPTIONS: { role: UserRole; emoji: string; title: string; desc: string }[] = [
  { role: 'customer', emoji: '🛍️', title: '소비자', desc: '동네 마감 할인을 픽업해요' },
  { role: 'seller', emoji: '🏪', title: '사장님', desc: '마감 상품을 등록·판매해요' },
];

export function RolePicker({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const active = o.role === value;
        return (
          <Pressable
            key={o.role}
            onPress={() => onChange(o.role)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.card, active && styles.active]}
          >
            <Text style={styles.emoji}>{o.emoji}</Text>
            <Text style={[styles.title, active && { color: colors.primary }]}>{o.title}</Text>
            <Text style={styles.desc}>{o.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, gap: 2,
  },
  active: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
  emoji: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  desc: { fontSize: 12, color: colors.textMuted },
});
