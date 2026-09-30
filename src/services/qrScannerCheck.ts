/** 네이티브: expo-camera 가 OS 스캐너(ML Kit / AVFoundation)를 쓰므로 별도 준비가 필요 없다. */
export async function checkQrScannerReady(): Promise<boolean> {
  return true;
}
