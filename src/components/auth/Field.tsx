import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius } from '../../constants/theme';

export const Field = forwardRef<TextInput, TextInputProps & { label: string }>(function Field({ label, style, ...props }, ref) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
});
