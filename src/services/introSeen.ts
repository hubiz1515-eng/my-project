import AsyncStorage from '@react-native-async-storage/async-storage';

/** 인트로(앱 소개)를 본 적이 있는지 — 기기별로 저장 (웹은 localStorage) */
const KEY = 'pickupdeal:introSeen:v1';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // 저장 실패 시 다음 실행에 인트로가 한 번 더 보일 뿐
  }
}
