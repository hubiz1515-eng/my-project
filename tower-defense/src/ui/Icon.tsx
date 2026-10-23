import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type IconName =
  | 'coin'
  | 'gem'
  | 'skull'
  | 'pause'
  | 'play'
  | 'fast'
  | 'back'
  | 'gear'
  | 'close'
  | 'up'
  | 'book'
  | 'hammer'
  | 'ticket'
  | 'star'
  | 'lock'
  | 'clover'
  | 'merge'
  | 'sell'
  | 'flask'
  | 'crown'
  | 'sword'
  | 'check'
  | 'volume'
  | 'mute'
  | 'vibrate'
  | 'refresh'
  | 'home'
  | 'dice';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

/** 자체 제작 벡터 아이콘 (24×24 기준) */
export function Icon({ name, size = 24, color = '#ffffff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape(name, color)}
    </Svg>
  );
}

function shape(name: IconName, color: string) {
  switch (name) {
    case 'coin':
      return (
        <G>
          <Defs>
            <LinearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#fff4b0" />
              <Stop offset="1" stopColor="#e0a020" />
            </LinearGradient>
          </Defs>
          <Circle cx="12" cy="12" r="10" fill="url(#cg)" stroke="#8a5a10" strokeWidth="1.6" />
          <Circle cx="12" cy="12" r="6.4" fill="none" stroke="#b07818" strokeWidth="1.4" />
          <Path d="M12 8v8M9.8 10.2h3.4a1.4 1.4 0 0 1 0 2.8h-2.4a1.4 1.4 0 0 0 0 2.8H14" stroke="#b07818" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'gem':
      return (
        <G>
          <Defs>
            <LinearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#e8ffff" />
              <Stop offset="0.5" stopColor="#5ac8ff" />
              <Stop offset="1" stopColor="#2a78d0" />
            </LinearGradient>
          </Defs>
          <Path d="M6 3h12l4 6-10 12L2 9z" fill="url(#gg)" stroke="#143a6a" strokeWidth="1.5" strokeLinejoin="round" />
          <Path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="#143a6a" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
          <Path d="M7 5l-2 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        </G>
      );
    case 'skull':
      return (
        <G>
          <Path d="M12 2.5c-4.6 0-8 3-8 7.2 0 2.5 1.2 4.3 3 5.4V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-3.9c1.8-1.1 3-2.9 3-5.4 0-4.2-3.4-7.2-8-7.2z" fill={color} />
          <Circle cx="8.8" cy="10.4" r="2" fill="#10152e" />
          <Circle cx="15.2" cy="10.4" r="2" fill="#10152e" />
          <Path d="M12 12.6l-1.2 2.4h2.4zM9.6 17.5v2.6M12 17.5v2.6M14.4 17.5v2.6" stroke="#10152e" strokeWidth="1.1" strokeLinecap="round" />
        </G>
      );
    case 'pause':
      return (
        <G fill={color}>
          <Rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
          <Rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
        </G>
      );
    case 'play':
      return <Path d="M7 4.5v15l12-7.5z" fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />;
    case 'fast':
      return (
        <G fill={color} stroke={color} strokeWidth="1.4" strokeLinejoin="round">
          <Path d="M3.5 5v14l8.5-7z" />
          <Path d="M12.5 5v14l8.5-7z" />
        </G>
      );
    case 'back':
      return <Path d="M15 4l-8 8 8 8" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
    case 'gear':
      return (
        <G>
          <Path
            d="M12 2.5l1.7 2.3 2.8-.7.9 2.8 2.8.9-.7 2.8 2.3 1.7-2.3 1.7.7 2.8-2.8.9-.9 2.8-2.8-.7L12 21.5l-1.7-2.3-2.8.7-.9-2.8-2.8-.9.7-2.8L2.5 12l2.3-1.7-.7-2.8 2.8-.9.9-2.8 2.8.7z"
            fill={color}
          />
          <Circle cx="12" cy="12" r="3.4" fill="#10152e" />
        </G>
      );
    case 'close':
      return <Path d="M5.5 5.5l13 13M18.5 5.5l-13 13" stroke={color} strokeWidth="3.2" strokeLinecap="round" />;
    case 'up':
      return <Path d="M5 14l7-7 7 7M5 21l7-7 7 7" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />;
    case 'book':
      return (
        <G fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <Path d="M12 6c-2-1.6-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14C17 4 14 4.4 12 6z" fill={color} fillOpacity="0.22" />
          <Path d="M12 6v14" />
        </G>
      );
    case 'hammer':
      return (
        <G>
          <Path d="M14 4l6 6-3 3-6-6z" fill={color} />
          <Path d="M10.5 8.5L4 15l5 5 6.5-6.5" fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" />
          <Path d="M7 17.5l-2.5 2.5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'ticket':
      return (
        <G>
          <Path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.4a2.6 2.6 0 0 0 0 5.2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.4a2.6 2.6 0 0 0 0-5.2z" fill={color} />
          <Path d="M9 8v8" stroke="#10152e" strokeWidth="1.6" strokeDasharray="1.6 2" />
          <Path d="M15 9l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="#10152e" />
        </G>
      );
    case 'star':
      return <Path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z" fill={color} stroke="#8a5a10" strokeWidth="1.2" strokeLinejoin="round" />;
    case 'lock':
      return (
        <G>
          <Rect x="5" y="10.5" width="14" height="10" rx="2.4" fill={color} />
          <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth="2.6" />
          <Circle cx="12" cy="15.5" r="1.6" fill="#10152e" />
        </G>
      );
    case 'clover':
      return (
        <G fill={color}>
          <Circle cx="8.6" cy="8.6" r="4.2" />
          <Circle cx="15.4" cy="8.6" r="4.2" />
          <Circle cx="8.6" cy="15.2" r="4.2" />
          <Circle cx="15.4" cy="15.2" r="4.2" />
          <Path d="M12 12c0 4 1.5 7 4.5 9.5" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'merge':
      return (
        <G fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 4l7 7 7-7" />
          <Path d="M12 11v9" />
          <Path d="M8.5 16.5L12 20l3.5-3.5" />
        </G>
      );
    case 'sell':
      return (
        <G fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="8.6" />
          <Path d="M12 7v10M9.4 9.4h4a1.7 1.7 0 0 1 0 3.4h-3a1.7 1.7 0 0 0 0 3.4H15" />
        </G>
      );
    case 'flask':
      return (
        <G>
          <Path d="M9.5 3h5M10.5 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5.5-10V3" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <Path d="M7.4 15.5h9.2l1.8 3.4A1 1 0 0 1 17.5 20.5h-11a1 1 0 0 1-.9-1.6z" fill={color} opacity="0.85" />
        </G>
      );
    case 'crown':
      return <Path d="M3 18.5h18l1.5-11-5.2 4.2L12 4.5 6.7 11.7 1.5 7.5z" fill={color} stroke="#8a5a10" strokeWidth="1.4" strokeLinejoin="round" />;
    case 'sword':
      return (
        <G fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19.5 4.5l-10 10M17 4h3.5v3.5M7 12l5 5M5.2 18.8l2.2-2.2M4 20l1.5-1.5" />
        </G>
      );
    case 'check':
      return <Path d="M4.5 12.5l5 5 10-11" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />;
    case 'volume':
      return (
        <G fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" fill={color} />
          <Path d="M15.5 9a4.4 4.4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
        </G>
      );
    case 'mute':
      return (
        <G fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" fill={color} />
          <Path d="M16 9.5l5 5M21 9.5l-5 5" />
        </G>
      );
    case 'vibrate':
      return (
        <G fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <Rect x="8" y="3.5" width="8" height="17" rx="2" fill={color} fillOpacity="0.25" />
          <Path d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4" />
        </G>
      );
    case 'refresh':
      return (
        <G fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <Path d="M20 4v5h-5" />
        </G>
      );
    case 'home':
      return <Path d="M3.5 11.5L12 4l8.5 7.5M6 10v9.5h4.5V14h3v5.5H18V10" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />;
    case 'dice':
      return (
        <G>
          <Rect x="3.5" y="3.5" width="17" height="17" rx="4" fill={color} />
          <Circle cx="8.5" cy="8.5" r="1.7" fill="#10152e" />
          <Circle cx="15.5" cy="8.5" r="1.7" fill="#10152e" />
          <Circle cx="12" cy="12" r="1.7" fill="#10152e" />
          <Circle cx="8.5" cy="15.5" r="1.7" fill="#10152e" />
          <Circle cx="15.5" cy="15.5" r="1.7" fill="#10152e" />
        </G>
      );
  }
}
