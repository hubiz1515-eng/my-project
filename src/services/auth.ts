import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { userDoc } from '../config/collections';
import { auth } from '../config/firebaseConfig';
import type { UserRole } from '../types/models';

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

/** users/{uid} 프로필 생성. 역할은 이후 변경 불가(보안 규칙). */
export async function createProfile(uid: string, p: ProfileInput) {
  await setDoc(userDoc(uid), {
    uid,
    role: p.role,
    name: p.name.trim(),
    phone: p.phone.trim(),
    pushTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function signOut() {
  await fbSignOut(auth);
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/user-not-found': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/wrong-password': '이메일 또는 비밀번호가 일치하지 않아요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
    'auth/operation-not-allowed':
      '이메일/비밀번호 로그인이 꺼져 있어요. Firebase 콘솔 > Authentication > 로그인 방법에서 활성화해 주세요.',
    'permission-denied': '프로필 저장 권한이 없어요. firestore.rules 가 배포됐는지 확인해 주세요.',
  };
  return map[code] ?? (e instanceof Error ? e.message : '문제가 발생했어요.');
}
