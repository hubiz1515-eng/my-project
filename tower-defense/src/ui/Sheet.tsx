import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { GText } from './bits';
import { Icon } from './Icon';
import { C } from './theme';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 화면 높이 대비 비율 */
  heightPct?: number;
  /** 배경 어둡게 (기본: 약하게) */
  dim?: number;
  bottomInset?: number;
}

/** 아래에서 올라오는 시트 (RN Modal 대신 절대 위치 — 웹/네이티브 동작이 같다) */
export function Sheet({ visible, title, onClose, children, heightPct = 0.6, dim = 0.35, bottomInset = 0 }: Props) {
  const a = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: visible ? 1 : 0, duration: visible ? 260 : 180, easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: false }).start();
  }, [visible, a]);
  const translate = a.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });
  const backdrop = a.interpolate({ inputRange: [0, 1], outputRange: [0, dim] });
  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { height: `${heightPct * 100}%`, transform: [{ translateY: translate }], paddingBottom: bottomInset + 8 }]}>
        <View style={styles.grab} />
        <View style={styles.header}>
          <GText size={22} color="#fff">
            {title}
          </GText>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={18} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderColor: C.edge,
    paddingHorizontal: 12,
    paddingTop: 6,
    overflow: 'hidden',
  },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.edge, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
