export interface Coords {
  latitude: number;
  longitude: number;
}

export interface MapPin extends Coords {
  id: string;
  /** 핀에 표시할 짧은 문구 (예: "-40%") */
  label: string;
}

export interface PickupMapProps {
  /** 지도 중심(선택한 매장 또는 내 위치) */
  center: Coords;
  user: Coords;
  pins: MapPin[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
}
