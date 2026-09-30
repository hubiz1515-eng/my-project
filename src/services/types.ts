export type Unsubscribe = () => void;
export type ErrorHandler = (error: Error) => void;

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Firestore/Auth 오류를 사용자 문구로 */
export function toUserMessage(e: unknown, fallback = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.'): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return '권한이 없어요. (보안 규칙이 배포됐는지 확인해 주세요)';
    case 'failed-precondition':
      return '필요한 Firestore 색인이 없어요. `firebase deploy --only firestore` 로 색인을 배포해 주세요.';
    case 'unavailable':
      return '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.';
    case 'aborted':
      return '동시에 다른 변경이 있었어요. 다시 시도해 주세요.';
  }
  if (e instanceof Error && e.message && !code) return e.message;
  return fallback;
}
