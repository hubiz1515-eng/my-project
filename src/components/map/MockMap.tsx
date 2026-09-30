import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors, radius } from '../../constants/theme';
import type { PickupMapProps } from '../../types/map';

const PAD = 40;
/** 핀 라벨 길이가 달라도 좌표 중앙에 오도록 고정 폭 슬롯 안에서 가운데 정렬 */
const PIN_SLOT = 100;

/** 카카오 JS 키가 없을 때 쓰는 대체 지도. 좌표를 화면 위치로 단순 투영해 핀을 그린다. */
export function MockMap({ user, pins, selectedId, onSelectPin }: PickupMapProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const points = [user, ...pins];
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const project = (lat: number, lng: number) => ({
    x: PAD + ((lng - minLng) / (maxLng - minLng || 1)) * Math.max(0, size.w - PAD * 2),
    y: PAD + ((maxLat - lat) / (maxLat - minLat || 1)) * Math.max(0, size.h - PAD * 2),
  });

  const me = project(user.latitude, user.longitude);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {[0.25, 0.5, 0.75].map((r) => (
        <View key={`h${r}`} style={[styles.gridH, { top: `${r * 100}%` }]} />
      ))}
      {[0.25, 0.5, 0.75].map((r) => (
        <View key={`v${r}`} style={[styles.gridV, { left: `${r * 100}%` }]} />
      ))}
      {size.w > 0 && (
        <>
          <View style={[styles.me, { left: me.x - 8, top: me.y - 8 }]} />
          {pins.map((pin) => {
            const { x, y } = project(pin.latitude, pin.longitude);
            const selected = pin.id === selectedId;
            return (
              <View
                key={pin.id}
                pointerEvents="box-none"
                style={[styles.pinSlot, { left: x - PIN_SLOT / 2, top: y - 14, zIndex: selected ? 2 : 1 }]}
              >
                <Pressable
                  onPress={() => onSelectPin(pin.id)}
                  hitSlop={8}
                  style={[styles.pin, selected && styles.pinSelected]}
                >
                  <Text style={[styles.pinText, selected && styles.pinTextSelected]}>{pin.label}</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      )}
      <Text style={styles.badge}>Mock 지도 · 카카오 키 미설정</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mapBg, overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#cfe4d3' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#cfe4d3' },
  me: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#fff',
  },
  pinSlot: { position: 'absolute', width: PIN_SLOT, alignItems: 'center' },
  pin: {
    minWidth: 48, height: 28, paddingHorizontal: 8, borderRadius: radius.pill,
    backgroundColor: '#fff', borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  pinSelected: { backgroundColor: colors.accent },
  pinText: { fontSize: 12, fontWeight: '800', color: colors.accent },
  pinTextSelected: { color: '#fff' },
  badge: { position: 'absolute', right: 8, bottom: 6, fontSize: 10, color: colors.textMuted },
});
