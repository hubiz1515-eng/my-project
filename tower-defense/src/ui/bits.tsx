import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { GRADES, type Grade } from '@/game/engine/units';
import { Icon, type IconName } from './Icon';
import { C, FONT } from './theme';

export function GText({ children, size = 16, color = C.text, style, numberOfLines }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: FONT, fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}

/** 아이콘 + 숫자 알약 */
export function Pill({ icon, value, color = C.text, style, minWidth = 70 }: { icon: IconName; value: string | number; color?: string; style?: StyleProp<ViewStyle>; minWidth?: number }) {
  return (
    <View style={[styles.pill, { minWidth }, style]}>
      <Icon name={icon} size={20} />
      <Text style={[styles.pillText, { color }]}>{value}</Text>
    </View>
  );
}

export function GradeChip({ grade, small }: { grade: Grade; small?: boolean }) {
  const g = GRADES[grade];
  return (
    <View style={[styles.chip, { backgroundColor: g.color, paddingHorizontal: small ? 6 : 9, paddingVertical: small ? 1 : 2 }]}>
      <Text style={[styles.chipText, { fontSize: small ? 11 : 13 }]}>{g.name}</Text>
    </View>
  );
}

export function Bar({ value, color = C.good, back = 'rgba(0,0,0,0.45)', height = 10, style }: { value: number; color?: string; back?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: back, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(8,12,34,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pillText: { fontFamily: FONT, fontSize: 17, marginTop: 1 },
  chip: { borderRadius: 8, alignSelf: 'flex-start' },
  chipText: { fontFamily: FONT, color: '#10152e' },
});
