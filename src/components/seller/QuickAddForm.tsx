import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { validateNewItem, type NewItemInput } from '../../utils/foodItemRules';
import { discountPercent, formatClock, formatWon } from '../../utils/format';
import { hhmmAfter, isTomorrow, nextOccurrenceMs } from '../../utils/pickupTime';

const DISCOUNT_PRESETS = [30, 50, 70];
const TIME_PRESETS = [30, 60, 120];

const toInt = (s: string) => {
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : NaN;
};

interface Props {
  /** 최근 등록한 상품: 탭하면 폼을 채워 재등록을 더 빠르게 */
  recent: { title: string; originalPrice: number; discountPrice: number }[];
  onSubmit: (input: NewItemInput) => Promise<void>;
}

export function QuickAddForm({ recent, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [original, setOriginal] = useState('');
  const [discount, setDiscount] = useState('');
  const [time, setTime] = useState(() => hhmmAfter(60, Date.now()));
  const [stock, setStock] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<TextInput>(null);

  const now = Date.now();
  const originalPrice = toInt(original);
  const discountPrice = toInt(discount);
  const pickupEndMs = nextOccurrenceMs(time, now);
  const percent =
    originalPrice > 0 && discountPrice > 0 && discountPrice <= originalPrice
      ? discountPercent(originalPrice, discountPrice)
      : null;

  const applyDiscount = (p: number) => {
    if (!(originalPrice > 0)) return setError('원가를 먼저 입력해 주세요.');
    setError(null);
    // 100원 단위 내림 — 가격표처럼 깔끔하게
    setDiscount(String(Math.floor((originalPrice * (100 - p)) / 100 / 100) * 100));
  };

  const fillFrom = (r: Props['recent'][number]) => {
    setTitle(r.title);
    setOriginal(String(r.originalPrice));
    setDiscount(String(r.discountPrice));
    setError(null);
  };

  const submit = async () => {
    const input: NewItemInput = {
      title,
      originalPrice,
      discountPrice,
      stock,
      pickupEndMs: pickupEndMs ?? NaN,
    };
    const problem = validateNewItem(input, Date.now());
    if (problem) return setError(problem);
    setSubmitting(true);
    try {
      await onSubmit(input);
      // 마감 시간·수량은 다음 등록에도 대부분 같으므로 유지
      setTitle('');
      setOriginal('');
      setDiscount('');
      setError(null);
      titleRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>⚡ 3초 상품 등록</Text>

      {recent.length > 0 && (
        <View style={styles.chips}>
          {recent.map((r) => (
            <Pressable key={r.title} onPress={() => fillFrom(r)} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>↺ {r.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        ref={titleRef}
        value={title}
        onChangeText={setTitle}
        placeholder="상품명 (예: 오늘의 빵 랜덤박스)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="next"
        maxLength={40}
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>원가</Text>
          <TextInput
            value={original}
            onChangeText={(t) => setOriginal(t.replace(/[^0-9]/g, ''))}
            placeholder="15000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>
            할인가 {percent !== null && <Text style={styles.percent}>-{percent}%</Text>}
          </Text>
          <TextInput
            value={discount}
            onChangeText={(t) => setDiscount(t.replace(/[^0-9]/g, ''))}
            placeholder="5900"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.chips}>
        {DISCOUNT_PRESETS.map((p) => (
          <Pressable key={p} onPress={() => applyDiscount(p)} style={styles.chip}>
            <Text style={styles.chipText}>{p}% 할인</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>픽업 마감</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="21:30"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            maxLength={5}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>수량</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => setStock((s) => Math.max(1, s - 1))} style={styles.stepBtn} hitSlop={6}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{stock}</Text>
            <Pressable onPress={() => setStock((s) => Math.min(99, s + 1))} style={styles.stepBtn} hitSlop={6}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.chips}>
        {TIME_PRESETS.map((m) => (
          <Pressable key={m} onPress={() => setTime(hhmmAfter(m, Date.now()))} style={styles.chip}>
            <Text style={styles.chipText}>{m < 60 ? `${m}분 후` : `${m / 60}시간 후`}</Text>
          </Pressable>
        ))}
        <Text style={styles.hint}>
          {pickupEndMs
            ? `${isTomorrow(pickupEndMs, now) ? '내일 ' : ''}${formatClock(pickupEndMs)}까지 픽업`
            : 'HH:mm 형식'}
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={submitting}
        style={({ pressed }) => [styles.submit, (pressed || submitting) && { opacity: 0.7 }]}
      >
        <Text style={styles.submitText}>
          {percent !== null ? `${formatWon(discountPrice)} × ${stock}개 등록하기` : '등록하기'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 8 },
  heading: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, gap: 4 },
  label: { fontSize: 12, color: colors.textMuted },
  percent: { color: colors.accent, fontWeight: '800' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: colors.primarySoft, maxWidth: 180,
  },
  chipText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted, marginLeft: 'auto' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 4, height: 42,
  },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '700', color: colors.text },
  stepValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  error: { color: colors.accent, fontSize: 13 },
  submit: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
