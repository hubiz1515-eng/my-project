import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, FONT } from './theme';

export type Variant = 'primary' | 'gold' | 'blue' | 'red' | 'violet' | 'dark' | 'ghost';

const PALETTE: Record<Variant, { top: string; edge: string; text: string }> = {
  primary: { top: '#4ee08a', edge: '#1e8a4a', text: '#06280f' },
  gold: { top: '#ffd24d', edge: '#c08a10', text: '#4a2e00' },
  blue: { top: '#5cb4ff', edge: '#2a62b8', text: '#04203f' },
  red: { top: '#ff6a82', edge: '#a82040', text: '#3a0412' },
  violet: { top: '#c48aff', edge: '#6a3aaa', text: '#22083f' },
  dark: { top: '#2e3a74', edge: '#161d44', text: '#ffffff' },
  ghost: { top: 'rgba(255,255,255,0.1)', edge: 'rgba(255,255,255,0.16)', text: '#ffffff' },
};

interface Props {
  label?: string;
  sub?: string;
  icon?: ReactNode;
  variant?: Variant;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string | number;
  style?: StyleProp<ViewStyle>;
  height?: number;
  fontSize?: number;
  glow?: boolean;
  /** 아이콘을 글자 위에 세로로 쌓는다 (좁은 버튼용) */
  vertical?: boolean;
  accessibilityLabel?: string;
  children?: ReactNode;
}

/** 두툼한 3D 느낌의 게임 버튼 */
export function GButton({ label, sub, icon, variant = 'primary', onPress, disabled, badge, style, height = 48, fontSize = 18, glow, vertical, accessibilityLabel, children }: Props) {
  const p = PALETTE[disabled ? 'dark' : variant];
  const edge = 5;
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={style} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }}>
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            {
              height,
              backgroundColor: p.top,
              borderBottomWidth: pressed ? 2 : edge,
              borderBottomColor: p.edge,
              marginTop: pressed ? edge - 2 : 0,
              opacity: disabled ? 0.55 : 1,
              borderColor: variant === 'ghost' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)',
            },
            vertical && { flexDirection: 'column', gap: 0, paddingHorizontal: 2 },
            glow && !disabled && styles.glow,
          ]}
        >
          <View style={styles.shine} />
          {icon}
          {children ?? (
            <View style={styles.texts}>
              {label ? (
                <Text style={[styles.label, { color: disabled ? '#9aa6d8' : p.text, fontSize }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
              {sub ? (
                <Text style={[styles.sub, { color: disabled ? '#7f8cc0' : p.text }]} numberOfLines={1}>
                  {sub}
                </Text>
              ) : null}
            </View>
          )}
          {badge !== undefined && badge !== 0 && badge !== '' ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    overflow: 'visible',
  },
  shine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 3,
    height: '34%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  texts: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT, textAlign: 'center' },
  sub: { fontFamily: FONT, fontSize: 12, opacity: 0.85, textAlign: 'center', marginTop: -1 },
  badge: {
    position: 'absolute',
    top: -9,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontFamily: FONT, fontSize: 13, lineHeight: 17 },
  glow: { shadowColor: '#ffe27a', shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
});
