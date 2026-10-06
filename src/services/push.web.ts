/** 웹은 푸시 알림 미지원 (expo-notifications 를 웹 번들에 넣지 않는다) */
export type PushSetupResult = { status: 'unsupported' };
export async function registerForPush(_uid: string): Promise<PushSetupResult> {
  return { status: 'unsupported' };
}
export async function unregisterPush(_uid: string): Promise<void> {}
export function notificationUrl(): string | null {
  return null;
}
