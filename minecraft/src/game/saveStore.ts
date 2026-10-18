import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'blockcraft.save.v1';
/** 편집 기록이 매우 많아져도 이 크기를 넘는 저장은 거부해 저장소를 보호한다 */
const MAX_SAVE_BYTES = 4 * 1024 * 1024;

export async function loadSave(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null; // 저장소를 못 읽어도 새 월드로 게임은 시작할 수 있다
  }
}

export async function writeSave(data: string): Promise<void> {
  if (data.length > MAX_SAVE_BYTES) return;
  try {
    await AsyncStorage.setItem(KEY, data);
  } catch {
    // 저장 실패가 플레이를 막으면 안 된다. 다음 자동 저장에서 다시 시도한다.
  }
}
