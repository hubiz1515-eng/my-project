export interface Coords {
  latitude: number;
  longitude: number;
}

export interface MapPin extends Coords {
  id: string;
  /** 핀에 표시할 짧은 문구 (예: "-40%") */
  label: string;
  /** 접근성/툴팁용 이름 (매장명) */
  title?: string;
}

export interface PickupMapProps {
  user: Coords;
  pins: MapPin[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
}

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
