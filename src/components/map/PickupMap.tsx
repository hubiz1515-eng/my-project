import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { colors, radius } from '../../constants/theme';
import { GOOGLE_MAPS_API_KEY, type MapPin, type PickupMapProps } from '../../types/map';
import { clusterPins, zoomFromLongitudeDelta, type Cluster } from '../../utils/cluster';
import { MapUnavailable } from './MapUnavailable';

const EDGE = { top: 90, right: 50, bottom: 40, left: 50 };

/**
 * 네이티브 지도 (react-native-maps).
 * Android: Google 지도 (app.config.ts 에서 키 주입), iOS: Apple 지도.
 * 축소 화면에서 겹치는 매장은 숫자 원으로 묶고, 누르면 확대해 펼친다.
 */
export function PickupMap({ user, pins, selectedId, onSelectPin }: PickupMapProps) {
  const mapRef = useRef<MapView>(null);
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(14);
  const selected = pins.find((p) => p.id === selectedId);
  const pinKey = pins.map((p) => p.id).join(',');
  const clusters = useMemo(() => clusterPins(pins, zoom), [pins, zoom]);

  // 핀이 바뀌면 전체가 보이도록
  useEffect(() => {
    const coords = [user, ...pins];
    // 매장과 내 위치가 거의 같으면 fit 대신 동네 단위로 (과확대 방지)
    const spread = Math.max(...coords.map((c) => Math.abs(c.latitude - user.latitude) + Math.abs(c.longitude - user.longitude)));
    if (coords.length > 1 && spread > 0.005) {
      mapRef.current?.fitToCoordinates(coords, { edgePadding: EDGE, animated: true });
    } else {
      mapRef.current?.animateToRegion({ ...user, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey]);

  // 매장 선택 시 그 위치로
  useEffect(() => {
    if (selected) mapRef.current?.animateCamera({ center: selected }, { duration: 300 });
  }, [selected]);

  const onRegionChangeComplete = (r: Region) => {
    const z = Math.round(zoomFromLongitudeDelta(r.longitudeDelta, width));
    if (z !== zoom) setZoom(z);
  };

  /** 묶음 클릭: 구성 매장이 모두 따로 보일 때까지 확대한 영역으로 이동 */
  const expand = (c: Cluster<MapPin>) => {
    let z = zoom + 1;
    while (z < 19 && clusterPins(c.members, z).length < c.members.length) z++;
    const lngDelta = (360 * width) / (256 * 2 ** z);
    const lats = c.members.map((m) => m.latitude);
    const lngs = c.members.map((m) => m.longitude);
    mapRef.current?.animateToRegion(
      {
        latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
        longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
        // 구성 매장 범위와, 모두 펼쳐지는 줌 중 더 넓은 쪽
        latitudeDelta: Math.max(lngDelta, (Math.max(...lats) - Math.min(...lats)) * 1.6),
        longitudeDelta: Math.max(lngDelta, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
      },
      350,
    );
  };

  if (Platform.OS === 'android' && !GOOGLE_MAPS_API_KEY) {
    return <MapUnavailable message="지도 API 키가 설정되지 않았어요" />;
  }

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      initialRegion={{ ...user, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {clusters.map((c) => {
        if (c.members.length === 1) {
          const pin = c.members[0];
          const on = pin.id === selectedId;
          return (
            <Marker
              key={c.id}
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
        }
        const n = c.members.length;
        const size = Math.min(56, 34 + n * 3);
        const on = c.members.some((m) => m.id === selectedId);
        return (
          <Marker
            key={c.id}
            coordinate={c}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => expand(c)}
            tracksViewChanges={false}
            zIndex={3}
            accessibilityLabel={`매장 ${n}곳 묶음`}
          >
            <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }, on && styles.clusterOn]}>
              <Text style={styles.clusterText}>{n}</Text>
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
  cluster: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent,
    borderWidth: 3, borderColor: '#fff',
  },
  clusterOn: { borderColor: colors.text },
  clusterText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
