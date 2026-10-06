import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../constants/theme';

/**
 * 되돌리기 어려운 동작(거절·취소)용 버튼. 한 번 누르면 확인 문구로 바뀌고 3초 안에 다시 눌러야 실행.
 * (Alert 확인창은 웹에서 동작하지 않아 이 방식을 사용)
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  style,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      style={({ pressed }) => [styles.btn, armed && styles.armed, pressed && { opacity: 0.6 }, style]}
    >
      <Text style={[styles.text, armed && styles.textArmed]}>{armed ? confirmLabel : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  armed: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  textArmed: { color: '#fff' },
});
