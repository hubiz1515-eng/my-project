import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { DEFAULT_LOCATION } from '../constants/theme';
import type { Coords } from '../types/map';

/** 권한 팝업 무응답 등으로 위치 확인이 지연될 때 기본 위치로 넘어가는 시간 */
const LOCATION_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('location timeout')), ms);
    promise.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}

export type LocationSource = 'loading' | 'device' | 'default';

/** 현재 위치. 권한 거부/실패 시 기본 위치(강남역)로 대체한다. */
export function useUserLocation(): { coords: Coords; source: LocationSource } {
  const [state, setState] = useState<{ coords: Coords; source: LocationSource }>({
    coords: DEFAULT_LOCATION,
    source: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await withTimeout(
          (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') throw new Error('permission denied');
            return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          })(),
          LOCATION_TIMEOUT_MS,
        );
        if (!cancelled) {
          setState({
            coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            source: 'device',
          });
        }
      } catch {
        if (!cancelled) setState({ coords: DEFAULT_LOCATION, source: 'default' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
