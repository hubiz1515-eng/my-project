import { Skia, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { Jua_400Regular } from '@expo-google-fonts/jua';
import { Asset } from 'expo-asset';

let typeface: SkTypeface | null = null;
let pending: Promise<SkTypeface | null> | null = null;
const fonts = new Map<number, SkFont>();

/**
 * Skia 용 한글 폰트(주아)를 불러온다.
 * (웹에서 useFont 훅이 화면을 멈추게 하는 문제가 있어 expo-asset + Skia.Data 로 직접 읽는다.)
 */
export function loadSkiaTypeface(): Promise<SkTypeface | null> {
  if (typeface) return Promise.resolve(typeface);
  if (!pending) {
    pending = (async () => {
      try {
        const asset = Asset.fromModule(Jua_400Regular);
        await asset.downloadAsync();
        const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
        typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      } catch (e) {
        console.warn('Skia 폰트 로드 실패', e);
      }
      return typeface;
    })();
  }
  return pending;
}

export function skiaFont(size: number): SkFont | null {
  if (!typeface) return null;
  let f = fonts.get(size);
  if (!f) {
    f = Skia.Font(typeface, size);
    fonts.set(size, f);
  }
  return f;
}
