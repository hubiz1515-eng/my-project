import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { CONSENT_ITEMS } from '../../services/consent';

export type ConsentState = Record<(typeof CONSENT_ITEMS)[number]['key'], boolean>;

export const EMPTY_CONSENT: ConsentState = { over14: false, terms: false, privacy: false, location: false };

export const allConsented = (c: ConsentState) => CONSENT_ITEMS.every((i) => c[i.key]);

/** 필수 약관 동의 (전체 동의 + 항목별 체크 + 전문 보기) */
export function ConsentChecklist({ value, onChange }: { value: ConsentState; onChange: (v: ConsentState) => void }) {
  const all = allConsented(value);
  const setAll = (on: boolean) =>
    onChange(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.key, on])) as ConsentState);

  return (
    <View style={styles.box}>
      <Check label="전체 동의" checked={all} onPress={() => setAll(!all)} strong />
      <View style={styles.divider} />
      {CONSENT_ITEMS.map((item) => (
        <View key={item.key} style={styles.row}>
          <Check
            label={`(필수) ${item.label}`}
            checked={value[item.key]}
            onPress={() => onChange({ ...value, [item.key]: !value[item.key] })}
          />
          {item.doc && (
            <Pressable
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc! } })}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={`${item.label} 전문 보기`}
            >
              <Text style={styles.view}>보기</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

function Check({ label, checked, onPress, strong }: { label: string; checked: boolean; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.check}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={label}
    >
      <View style={[styles.box16, checked && styles.box16On]}>{checked && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={[styles.label, strong && styles.strong]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
    padding: 12, gap: 8,
  },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, paddingVertical: 2 },
  box16: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  box16On: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  label: { fontSize: 14, color: colors.text, flexShrink: 1 },
  strong: { fontWeight: '800', fontSize: 15 },
  view: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
});
