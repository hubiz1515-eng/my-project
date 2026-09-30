import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { userDoc } from '../config/collections';
import { auth } from '../config/firebaseConfig';
import { createProfile, signUp as authSignUp, type ProfileInput } from '../services/auth';
import type { User } from '../types/models';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** 로그인은 됐지만 users/{uid} 프로필이 없음 (가입 도중 앱 종료 등) */
  | { status: 'needsProfile'; user: FirebaseUser }
  | { status: 'ready'; user: FirebaseUser; profile: User };

interface AuthContextValue {
  state: AuthState;
  /** 계정 생성 + 프로필 저장. 진행 중에는 가입 화면을 유지한다. */
  signUpWithProfile: (email: string, password: string, profile: ProfileInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<User | null | undefined>(undefined);
  const [signingUp, setSigningUp] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    return onSnapshot(
      userDoc(user.uid),
      (snap) => setProfile(snap.exists() ? snap.data() : null),
      () => setProfile(null),
    );
  }, [user]);

  const signUpWithProfile = useCallback(async (email: string, password: string, p: ProfileInput) => {
    setSigningUp(true);
    try {
      const uid = await authSignUp(email, password);
      await createProfile(uid, p);
    } finally {
      setSigningUp(false);
    }
  }, []);

  const state = useMemo<AuthState>(() => {
    if (user === undefined) return { status: 'loading' };
    if (user === null) return { status: 'signedOut' };
    if (profile === undefined) return signingUp ? { status: 'signedOut' } : { status: 'loading' };
    if (profile === null) return signingUp ? { status: 'signedOut' } : { status: 'needsProfile', user };
    return { status: 'ready', user, profile };
  }, [user, profile, signingUp]);

  const value = useMemo(() => ({ state, signUpWithProfile }), [state, signUpWithProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider 안에서만 사용할 수 있어요.');
  return ctx;
}

/** 로그인 + 프로필이 보장된 화면(보호 라우트)에서 사용 */
export function useProfile(): User {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('로그인이 필요해요.');
  return state.profile;
}
