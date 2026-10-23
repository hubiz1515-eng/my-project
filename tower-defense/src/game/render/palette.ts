import { Skia, type SkColor } from '@shopify/react-native-skia';

type RGB = [number, number, number];

const rgbCache = new Map<string, RGB>();

export function parseHex(hex: string): RGB {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  const at = h.indexOf('@');
  if (at >= 0) h = h.slice(0, at);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  c = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  rgbCache.set(hex, c);
  return c;
}

const colorCache = new Map<string, SkColor>();

/** "#rrggbb" → Skia 색 (캐시). 알파는 paint.setAlphaf 로 조절하는 것을 권장 */
export function col(hex: string, alpha = 1): SkColor {
  // '#rrggbb@0.5' 처럼 알파를 붙여 쓸 수 있다
  const at = hex.indexOf('@');
  if (at >= 0) {
    alpha *= parseFloat(hex.slice(at + 1));
    hex = hex.slice(0, at);
  }
  const key = alpha === 1 ? hex : `${hex}@${alpha}`;
  let c = colorCache.get(key);
  if (!c) {
    const [r, g, b] = parseHex(hex);
    c = Float32Array.of(r, g, b, alpha);
    colorCache.set(key, c);
  }
  return c;
}

export function toHex([r, g, b]: RGB): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** a→b 로 t(0..1) 만큼 섞는다 */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** f<0: 어둡게, f>0: 밝게 (-1..1) */
export function shade(hex: string, f: number): string {
  return f < 0 ? mix(hex, '#000000', -f) : mix(hex, '#ffffff', f);
}

export const PALETTE = {
  ink: '#1b1530',
  white: '#ffffff',
  gold: '#ffd166',
  goldDeep: '#e0a020',
  sky: '#7be0ff',
  danger: '#ff4d6d',
  good: '#7dff9b',
  ui: {
    bg: '#0d1224',
    panel: '#182042',
    panelHi: '#232d5c',
    edge: '#3a4888',
  },
} as const;
