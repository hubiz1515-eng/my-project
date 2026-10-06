import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { col } from './db';

/**
 * Expo 푸시 서비스(https://exp.host)로 발송. Expo 가 Android(FCM)·iOS(APNs) 로 전달한다.
 * 앱 쪽 토큰 등록: src/services/push.ts
 */
const DEFAULT_API = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

/** 테스트에서 가짜 푸시 서버를 가리킬 때만 (에뮬레이터 전용) */
function apiUrl(): string {
  const override = process.env.PUSH_API_URL;
  return process.env.FUNCTIONS_EMULATOR === 'true' && override ? override : DEFAULT_API;
}

export interface PushMessage {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 앱이 여는 경로 (expo-router href) */
  url: string;
}

const isExpoToken = (t: unknown): t is string => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t);

/** 사용자의 모든 기기로 발송. 만료된 토큰(DeviceNotRegistered)은 프로필에서 제거한다. */
export async function sendPushToUser(uid: string, msg: PushMessage): Promise<number> {
  const snap = await col.users().doc(uid).get();
  const tokens = ((snap.get('pushTokens') as unknown[]) ?? []).filter(isExpoToken);
  if (tokens.length === 0) return 0;

  const dead: string[] = [];
  let sent = 0;
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title: msg.title,
          body: msg.body,
          data: { url: msg.url },
          sound: 'default',
          priority: 'high',
          channelId: 'orders',
        })),
      ),
    });
    if (!res.ok) {
      // 일시 오류는 트리거 재시도에 맡긴다
      throw new Error(`push api ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    (json.data ?? []).forEach((ticket, j) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[j]);
      else logger.warn('push ticket error', { uid, error: ticket.details?.error });
    });
  }
  if (dead.length) {
    await col.users().doc(uid).update({ pushTokens: FieldValue.arrayRemove(...dead) });
  }
  return sent;
}
