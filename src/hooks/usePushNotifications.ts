import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { notificationUrl, registerForPush } from '../services/push';

/**
 * 로그인 상태에서: 푸시 토큰 등록 + 알림을 눌렀을 때 해당 화면으로 이동
 * (앱이 꺼진 상태에서 알림으로 실행된 경우 포함).
 */
export function usePushNotifications(uid: string | null) {
  const registeredFor = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || registeredFor.current === uid || Platform.OS === 'web') return;
    registeredFor.current = uid;
    registerForPush(uid).then((r) => {
      if (__DEV__ && r.status !== 'registered') console.info('[push]', r.status, 'reason' in r ? r.reason ?? '' : '');
    });
  }, [uid]);

  useEffect(() => {
    if (!uid || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = notificationUrl(lastResponse);
    if (url) requestAnimationFrame(() => router.push(url as never));
  }, [uid, lastResponse]);
}
