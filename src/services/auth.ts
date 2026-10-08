import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { userDoc } from '../config/collections';
import { auth, functions } from '../config/firebaseConfig';
import type { UserRole } from '../types/models';
import { currentAgreements } from './consent';
import { unregisterPush } from './push';
import { toUserMessage } from './types';

export interface ProfileInput {
  name: string;
  phone: string;
  role: UserRole;
}

export function validateProfile(p: ProfileInput): string | null {
  if (!p.name.trim()) return '이름(닉네임)을 입력해 주세요.';
  if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(p.phone.trim())) return '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)';
  return null;
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user.uid;
}

/**
 * users/{uid} 프로필 생성. 역할은 이후 변경 불가(보안 규칙).
 * 화면에서 필수 약관 동의(ConsentChecklist)를 받은 뒤에만 호출한다 — 동의 기록을 함께 저장.
 */
export async function createProfile(uid: string, p: ProfileInput) {
  await setDoc(userDoc(uid), {
    uid,
    role: p.role,
    name: p.name.trim(),
    phone: p.phone.trim(),
    pushTokens: [],
    agreements: currentAgreements(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function signOut() {
  const uid = auth.currentUser?.uid;
  if (uid) await unregisterPush(uid);
  await fbSignOut(auth);
}

/**
 * 비밀번호 재설정 메일 (Firebase 기본 메일, 한국어).
 * 가입 여부를 노출하지 않도록 '없는 계정'도 성공처럼 처리한다
 * (실서버는 이메일 열거 보호로 원래 오류가 없고, 에뮬레이터·구 프로젝트는 user-not-found 를 준다).
 */
export async function sendPasswordReset(email: string) {
  auth.languageCode = 'ko';
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    if ((e as { code?: string })?.code !== 'auth/user-not-found') throw e;
  }
}

const deleteAccountFn = httpsCallable<void, { deleted: boolean }>(functions, 'deleteAccount');

/**
 * 회원 탈퇴: 비밀번호로 재인증 → 서버가 진행 중 주문 확인 후 매장·상품·프로필·계정 삭제.
 * 진행 중인 주문이 있으면 서버가 failed-precondition 으로 거부한다 (메시지 그대로 표시).
 */
export async function deleteMyAccount(password: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  await deleteAccountFn();
  await fbSignOut(auth).catch(() => {});
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.startsWith('functions/')) return toUserMessage(e);
  const map: Record<string, string> = {
    'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/user-not-found': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/wrong-password': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
    'auth/missing-password': '비밀번호를 입력해 주세요.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.',
    'auth/operation-not-allowed':
      '이메일/비밀번호 로그인이 꺼져 있어요. Firebase 콘솔 > Authentication > 로그인 방법에서 활성화해 주세요.',
    'permission-denied': '프로필 저장 권한이 없어요. firestore.rules 가 배포됐는지 확인해 주세요.',
  };
  return map[code] ?? (e instanceof Error ? e.message : '문제가 발생했어요.');
}
