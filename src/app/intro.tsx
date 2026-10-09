import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';
import { hasSeenIntro, markIntroSeen } from '../services/introSeen';
import { APP_LOGO } from '../constants/brand';

interface Slide {
  emoji: string;
  tint: string;
  bg: string;
  kicker: string;
  title: string;
  body: string;
  points: string[];
}

const SLIDES: Slide[] = [
  {
    emoji: '🥐',
    tint: colors.primary,
    bg: colors.primarySoft,
    kicker: '우리 동네 마감 할인',
    title: '버려질 음식을\n반값에 구해요',
    body: '문 닫기 전 남은 빵·도시락·반찬을 동네 가게에서 할인가로 만나보세요.',
    points: ['지도에서 내 주변 마감 할인 한눈에', '최대 70% 할인 · 남은 수량 실시간 표시'],
  },
  {
    emoji: '🛍️',
    tint: '#1d4ed8',
    bg: '#dbeafe',
    kicker: '100% 매장 픽업',
    title: '배달비 0원,\n직접 받아가요',
    body: '배달 없이 가게에 들러 바로 받아가요. 같은 가게 메뉴는 한 번에 담을 수 있어요.',
    points: ['결제 후 픽업 마감 시간까지 방문', '사장님 수락 전에는 언제든 취소·환불'],
  },
  {
    emoji: '📱',
    tint: '#b45309',
    bg: '#fef3c7',
    kicker: '3초 픽업',
    title: 'QR 하나로\n바로 픽업 끝',
    body: '주문하면 픽업 QR과 6자리 코드가 생겨요. 매장에서 보여주기만 하면 돼요.',
    points: ['주문 수락·픽업 완료를 알림으로 확인', '토스페이먼츠 · 카카오페이 안전 결제'],
  },
  {
    emoji: '🏪',
    tint: colors.text,
    bg: '#e5e7eb',
    kicker: '사장님이라면',
    title: '10초 등록,\n완전한 통제권',
    body: '상품명·가격·마감시간·수량만 입력하면 끝. 판매 재개는 오직 사장님이 직접 결정해요.',
    points: ['재고 −1 / +1 · 판매중지 · 품절 원터치', '새 주문 실시간 알림 · QR 스캔 픽업 확인'],
  },
];

/** 첫 실행 시 보여주는 앱 소개. 한 번 보면 다음부터는 바로 로그인 화면으로. */
export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    hasSeenIntro().then((seen) => {
      if (seen) router.replace('/login');
      else setChecked(true);
    });
  }, []);

  const last = index === SLIDES.length - 1;

  const finish = async (to: '/signup' | '/login') => {
    await markIntroSeen();
    router.replace(to);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  if (!checked) return <View style={styles.container} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>{APP_LOGO}</Text>
        {!last && (
          <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.flex}
      >
        {SLIDES.map((s) => (
          <View key={s.kicker} style={[styles.slide, { width }]}>
            <View style={[styles.hero, { backgroundColor: s.bg }]}>
              <Text style={styles.heroEmoji}>{s.emoji}</Text>
            </View>
            <Text style={[styles.kicker, { color: s.tint }]}>{s.kicker}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
            <View style={styles.points}>
              {s.points.map((p) => (
                <View key={p} style={styles.pointRow}>
                  <Text style={[styles.check, { color: s.tint }]}>✓</Text>
                  <Text style={styles.point}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`${SLIDES.length}장 중 ${index + 1}번째`}>
        {SLIDES.map((s, i) => (
          <Pressable key={s.kicker} onPress={() => goTo(i)} hitSlop={6}>
            <View style={[styles.dot, i === index && styles.dotOn]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        {last ? (
          <>
            <Pressable onPress={() => finish('/signup')} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>시작하기</Text>
            </Pressable>
            <Pressable onPress={() => finish('/login')} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>이미 계정이 있어요 · 로그인</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => goTo(index + 1)} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>다음</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  logo: { fontSize: 18, fontWeight: '800', color: colors.text },
  skip: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  slide: { paddingHorizontal: 28, justifyContent: 'center', gap: 10 },
  hero: { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  heroEmoji: { fontSize: 80 },
  kicker: { fontSize: 14, fontWeight: '800' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  points: { marginTop: 8, gap: 8 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check: { fontSize: 15, fontWeight: '900' },
  point: { flex: 1, fontSize: 14, color: colors.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 22, backgroundColor: colors.primary },
  actions: { paddingHorizontal: 20, gap: 8, width: '100%', maxWidth: 520, alignSelf: 'center' },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
