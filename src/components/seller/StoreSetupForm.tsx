import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, DEFAULT_LOCATION, radius } from '../../constants/theme';
import { canGeocode, createStore, geocodeAddress, validateStore } from '../../services/stores';
import { toUserMessage } from '../../services/types';
import type { Coords } from '../../types/map';
import { Field } from '../auth/Field';
import { PrimaryButton } from '../PrimaryButton';

type Pos = Coords & { source: 'none' | 'device' | 'geocode' | 'default' };

/** 사장님 첫 진입: 매장 등록 (계정당 1개) */
export function StoreSetupForm({ ownerId }: { ownerId: string }) {
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [pos, setPos] = useState<Pos>({ ...DEFAULT_LOCATION, source: 'none' });
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useDeviceLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('위치 권한이 필요해요.');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude, source: 'device' });
    } catch (e) {
      setError(`${e instanceof Error ? e.message : '위치를 가져오지 못했어요.'} 기본 위치(강남역)를 사용할 수 있어요.`);
    } finally {
      setLocating(false);
    }
  };

  const findByAddress = async () => {
    setLocating(true);
    setError(null);
    try {
      const r = await geocodeAddress(address);
      if (!r) throw new Error('주소를 찾지 못했어요.');
      setPos({ latitude: r.latitude, longitude: r.longitude, source: 'geocode' });
      setAddress(r.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : '주소 검색에 실패했어요.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (pos.source === 'none') return setError('매장 위치를 설정해 주세요.');
    const input = { storeName, address, latitude: pos.latitude, longitude: pos.longitude };
    const problem = validateStore(input);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await createStore(ownerId, input);
    } catch (e) {
      setError(toUserMessage(e, '매장 등록에 실패했어요.'));
      setBusy(false);
    }
  };

  const posLabel = {
    none: '아직 설정하지 않았어요',
    device: '현재 위치로 설정됨',
    geocode: '주소 위치로 설정됨',
    default: '기본 위치(강남역)로 설정됨',
  }[pos.source];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏪 매장 등록</Text>
      <Text style={styles.sub}>매장 정보를 등록하면 바로 마감 상품을 올릴 수 있어요.</Text>
      <Field label="매장 이름" value={storeName} onChangeText={setStoreName} placeholder="골목 베이커리" maxLength={30} />
      <Field label="주소" value={address} onChangeText={setAddress} placeholder="서울시 강남구 테헤란로 123" />

      <Text style={styles.label}>매장 위치 (지도 표시·근처 검색용)</Text>
      <View style={styles.row}>
        <Chip label="📍 지금 위치" onPress={useDeviceLocation} disabled={locating} />
        {canGeocode && <Chip label="🔎 주소로 찾기" onPress={findByAddress} disabled={locating || !address.trim()} />}
        <Chip label="기본 위치" onPress={() => setPos({ ...DEFAULT_LOCATION, source: 'default' })} disabled={locating} />
      </View>
      <Text style={[styles.pos, pos.source !== 'none' && { color: colors.primary }]}>
        {locating ? '위치 확인 중…' : `${posLabel}${pos.source !== 'none' ? ` (${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)})` : ''}`}
      </Text>
      {!canGeocode && <Text style={styles.hint}>매장 안에서 '지금 위치'를 누르면 가장 정확해요.</Text>}

      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label="매장 등록하기" onPress={submit} busy={busy} />
      <Text style={styles.hint}>영업시간은 기본값(매일 09:00~22:00)으로 등록돼요.</Text>
    </View>
  );
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, disabled && { opacity: 0.5 }]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pos: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  error: { color: colors.accent, fontSize: 13 },
});
