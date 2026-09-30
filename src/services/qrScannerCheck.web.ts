/**
 * 웹: expo-camera 는 브라우저 BarcodeDetector 가 없으면(Chrome 데스크톱·Firefox·Safari 등)
 * `barcode-detector` 폴리필(ZXing wasm, jsdelivr CDN 에서 다운로드)을 쓴다.
 * wasm 을 못 받으면 카메라는 켜지지만 영원히 인식하지 못하고 오류만 반복되므로,
 * 카메라를 켜기 전에 같은 모듈을 한 번 실행해 보고 실패하면 코드 입력으로 대체한다.
 */
const TIMEOUT_MS = 10000;

// 실패는 여기서 처리(코드 입력으로 대체)하므로 ZXing 이 console.error/warn 으로 남기는 로그는 숨긴다.
// (개발 모드 LogBox 가 코드 입력칸을 가리는 것 방지. 웹 LogBox 는 ignoreLogs 를 따르지 않음)
const HANDLED_ZXING_ERRORS = [
  'wasm streaming compile failed',
  'failed to asynchronously prepare wasm',
  'both async and sync fetching of the wasm failed',
  'falling back to ArrayBuffer instantiation',
];

type ConsoleFn = (...args: unknown[]) => void;
function filtered(original: ConsoleFn): ConsoleFn {
  return (...args) => {
    const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    if (!HANDLED_ZXING_ERRORS.some((m) => text.includes(m))) original(...args);
  };
}

export async function checkQrScannerReady(): Promise<boolean> {
  if ('BarcodeDetector' in globalThis) return true;
  const { error: originalError, warn: originalWarn } = console;
  console.error = filtered(originalError);
  console.warn = filtered(originalWarn);
  try {
    const { BarcodeDetector } = await import('barcode-detector');
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    await Promise.race([
      detector.detect(new ImageData(1, 1)), // 이 호출에서 wasm 로드
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    return true;
  } catch (e) {
    if (__DEV__) console.info('[qr] 웹 QR 인식 모듈 준비 실패 → 코드 입력으로 대체', e instanceof Error ? e.message : e);
    return false;
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}
