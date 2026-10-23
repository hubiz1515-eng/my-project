export const C = {
  bg: '#0d1224',
  bg2: '#141b38',
  panel: '#182042',
  panelHi: '#232d5c',
  panelLo: '#10152e',
  edge: '#3a4888',
  text: '#ffffff',
  sub: '#a9b8f0',
  dim: '#6c7bb8',
  gold: '#ffd166',
  goldDeep: '#d9962a',
  gem: '#7be0ff',
  gemDeep: '#2a9ad0',
  danger: '#ff4d6d',
  dangerDeep: '#b02040',
  good: '#7dff9b',
  goodDeep: '#2a9a50',
  violet: '#b46cff',
  blue: '#4fa8ff',
  blueDeep: '#2a62b8',
} as const;

/** expo-font 로 불러오는 한글 폰트 이름 */
export const FONT = 'Jua';

export const shadow = (color = '#000', y = 3, blur = 6, opacity = 0.35) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: blur,
  elevation: Math.round(blur / 2),
});
