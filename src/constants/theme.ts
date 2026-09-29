export const colors = {
  primary: '#16a34a',
  primarySoft: '#dcfce7',
  accent: '#ef4444',
  accentSoft: '#fee2e2',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  surface: '#ffffff',
  background: '#f3f4f6',
  mapBg: '#e8f3ea',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** 카카오 키가 없거나 위치 권한이 거부됐을 때 사용하는 기본 위치 (강남역) */
export const DEFAULT_LOCATION = { latitude: 37.4979, longitude: 127.0276 } as const;
