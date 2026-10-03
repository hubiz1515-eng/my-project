import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius } from '../../constants/theme';
import { GOOGLE_MAPS_API_KEY, type PickupMapProps } from '../../types/map';
import { MapUnavailable } from './MapUnavailable';

/**
 * 네이티브 지도 (react-native-maps).
 * Android: Google 지도 (app.config.ts 에서 키 주입), iOS: Apple 지도.
 */
export function PickupMap({ user, pins, selectedId, onSelectPin }: PickupMapProps) {
  const mapRef = useRef<MapView>(null);
  const selected = pins.find((p) => p.id === selectedId);
  const pinKey = pins.map((p) => p.id).join(',');

  // 핀이 바뀌면 전체가 보이도록
  useEffect(() => {
    const coords = [user, ...pins];
    if (coords.length > 1) {
      mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 90, right: 50, bottom: 40, left: 50 }, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey]);

  // 매장 선택 시 그 위치로
  useEffect(() => {
    if (selected) mapRef.current?.animateCamera({ center: selected }, { duration: 300 });
  }, [selected]);

  if (Platform.OS === 'android' && !GOOGLE_MAPS_API_KEY) {
    return <MapUnavailable message="지도 API 키가 설정되지 않았어요" />;
  }

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      initialRegion={{ ...user, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {pins.map((pin) => {
        const on = pin.id === selectedId;
        return (
          <Marker
            key={pin.id}
            coordinate={pin}
            title={pin.title}
            onPress={() => onSelectPin(pin.id)}
            tracksViewChanges={false}
            zIndex={on ? 2 : 1}
          >
            <View style={[styles.pin, on && styles.pinOn]}>
              <Text style={[styles.pinText, on && styles.pinTextOn]}>{pin.label}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    paddingHorizontal: 8, height: 28, borderRadius: radius.pill, justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2, borderColor: colors.accent,
  },
  pinOn: { backgroundColor: colors.accent },
  pinText: { fontSize: 12, fontWeight: '800', color: colors.accent },
  pinTextOn: { color: '#fff' },
});
