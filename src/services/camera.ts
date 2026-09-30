import { Platform } from 'react-native';
import { checkQrScannerReady } from './qrScannerCheck';

type CameraModule = typeof import('expo-camera');

let cached: CameraModule | null | undefined;

/**
 * expo-camera 를 지연 로드한다. 이 모듈은 import 시점에 네이티브 모듈을 요구하므로,
 * 카메라가 빠진 빌드에서 정적으로 import 하면 앱 시작 시 전체가 죽는다.
 * 실패하면 null → 화면은 코드 직접 입력으로 대체.
 */
export function loadCameraModule(): CameraModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-camera') as CameraModule;
  } catch (e) {
    if (__DEV__) console.warn('[camera] expo-camera 를 불러오지 못했어요', e);
    cached = null;
  }
  return cached;
}

export type CameraUnavailableReason = 'module' | 'insecure' | 'unsupported' | 'no-camera' | 'scanner';

/** 카메라를 쓸 수 없는 이유를 미리 판별 (웹: HTTPS·API·장치 유무). 쓸 수 있으면 null */
export async function checkCameraAvailability(): Promise<CameraUnavailableReason | null> {
  if (!loadCameraModule()) return 'module';
  if (Platform.OS !== 'web') return null;
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!md?.getUserMedia) return 'unsupported';
  try {
    const devices = await md.enumerateDevices();
    if (!devices.some((d) => d.kind === 'videoinput')) return 'no-camera';
  } catch {
    // 장치 목록을 못 얻으면 일단 시도해 본다
  }
  if (!(await checkQrScannerReady())) return 'scanner';
  return null;
}

export const CAMERA_UNAVAILABLE_MESSAGE: Record<CameraUnavailableReason, string> = {
  module: '이 앱 빌드에서는 카메라를 사용할 수 없어요.',
  insecure: '웹에서는 HTTPS 주소에서만 카메라를 쓸 수 있어요.',
  unsupported: '이 브라우저는 카메라를 지원하지 않아요.',
  'no-camera': '사용할 수 있는 카메라가 없어요.',
  scanner: 'QR 인식 모듈을 불러오지 못했어요. 네트워크를 확인해 주세요.',
};
