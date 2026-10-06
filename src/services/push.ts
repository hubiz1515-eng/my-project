import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayRemove, arrayUnion, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { userDoc } from '../config/collections';

/**
 * 푸시 알림 (Expo 푸시 서비스 → FCM/APNs). 서버 발송: functions/src/orderNotifications.ts
 * 동작 조건: 실기기 + 개발/운영 빌드 + EAS 프로젝트 ID(app.json extra.eas.projectId).
 * 웹·시뮬레이터·Expo Go(SDK 53+ Android) 에서는 조용히 건너뛴다 — 앱 안 알림(OrderToast)은 그대로 동작.
 */

export type PushSetupResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' | 'denied' | 'no-project' | 'error'; reason?: string };

/** 주문 알림 채널 (Android 8+). 서버가 channelId: 'orders' 로 보낸다. */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: '주문 알림',
    description: '새 주문, 주문 수락·픽업 완료·취소 알림',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

let currentToken: string | null = null;

/** 권한 요청 → 토큰 발급 → users/{uid}.pushTokens 에 추가 (기기별, 중복 없음) */
export async function registerForPush(uid: string): Promise<PushSetupResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return { status: 'unsupported' };
  const projectId = easProjectId();
  if (!projectId) return { status: 'no-project', reason: 'EAS projectId 가 없어요 (npx eas-cli init)' };
  try {
    await ensureAndroidChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { status: 'denied' };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await updateDoc(userDoc(uid), { pushTokens: arrayUnion(token), updatedAt: serverTimestamp() });
    currentToken = token;
    return { status: 'registered', token };
  } catch (e) {
    if (__DEV__) console.warn('[push] 등록 실패', e);
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 로그아웃 전에 호출 — 이 기기로 다른 계정 알림이 가지 않도록 토큰 제거 */
export async function unregisterPush(uid: string): Promise<void> {
  if (!currentToken) return;
  try {
    await updateDoc(userDoc(uid), { pushTokens: arrayRemove(currentToken) });
  } catch {
    // 로그아웃은 계속 진행 (만료된 토큰은 서버가 발송 시 정리)
  }
  currentToken = null;
}

/** 알림 데이터의 url 이 앱 내부 경로일 때만 반환 (외부 링크 차단) */
export function notificationUrl(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

if (Platform.OS !== 'web') {
  // 앱이 켜져 있을 때는 화면 안 알림(OrderToast)이 보여주므로 시스템 배너는 띄우지 않고 알림 목록에만 남긴다
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
