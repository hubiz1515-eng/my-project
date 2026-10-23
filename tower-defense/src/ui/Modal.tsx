import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GText } from './bits';
import { Icon } from './Icon';
import { C } from './theme';

/** 화면 중앙 팝업 (절대 위치 오버레이) */
export function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="팝업 닫기" />
      <View style={styles.card}>
        <View style={styles.header}>
          <GText size={22}>{title}</GText>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={18} />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,8,25,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  card: { width: '100%', maxWidth: 380, gap: 10, padding: 16, borderRadius: 24, backgroundColor: C.panel, borderWidth: 3, borderColor: C.edge },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
