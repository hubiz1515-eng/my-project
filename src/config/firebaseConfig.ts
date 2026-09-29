import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Expo 는 `process.env.EXPO_PUBLIC_*` 를 빌드 시점에 정적 치환하므로
// 동적 접근(process.env[key])이 아닌 리터럴로 참조해야 합니다.
const env = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(env)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Firebase 환경변수가 비어 있습니다: ${missing.join(', ')}\n` +
      '.env.example 을 .env 로 복사해 값을 채운 뒤 `npx expo start -c` 로 재시작하세요.',
  );
}

const firebaseConfig = env as Record<keyof typeof env, string>;

// Fast Refresh 로 모듈이 재평가돼도 앱을 중복 초기화하지 않습니다.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(firebaseApp: FirebaseApp): Auth {
  // 웹은 기본 persistence(IndexedDB)를 사용합니다.
  if (Platform.OS === 'web') return getAuth(firebaseApp);
  try {
    // 네이티브: 로그인 상태를 AsyncStorage 에 유지해 앱 재실행 후에도 로그인 유지.
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh 등으로 이미 초기화된 경우 기존 인스턴스를 재사용.
    return getAuth(firebaseApp);
  }
}

export const auth: Auth = createAuth(app);
export const db: Firestore = getFirestore(app);
