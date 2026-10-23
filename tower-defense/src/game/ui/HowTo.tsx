import { ScrollView, StyleSheet, View } from 'react-native';
import { GText } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { Icon, type IconName } from '@/ui/Icon';
import { Popup } from '@/ui/Modal';
import { C } from '@/ui/theme';

const STEPS: { icon: IconName; color: string; title: string; body: string }[] = [
  { icon: 'play', color: '#4ee08a', title: '소환', body: '골드로 유닛을 랜덤 소환해요. 같은 유닛은 한 칸에 최대 3기까지 쌓여요. 소환할 때마다 비용이 조금씩 올라요.' },
  { icon: 'merge', color: '#ffd24d', title: '합성', body: '같은 유닛 3기를 합치면 한 단계 높은 등급의 랜덤 유닛이 나와요. 가끔 두 단계가 오르는 "대박"도 터져요!' },
  { icon: 'crown', color: '#ff7ac0', title: '조합', body: '전설·영웅·희귀 같은 재료를 보드에 모으면 신화, 초월 유닛을 조합할 수 있어요. 조합 버튼에서 레시피를 확인하세요.' },
  { icon: 'clover', color: '#7dff9b', title: '운빨', body: '행운 게이지가 차면 영웅 이상이 확정! 5웨이브마다·보스를 잡으면 룰렛 티켓을 얻고, 보스는 보석을 줘요.' },
  { icon: 'skull', color: '#ff6a82', title: '목표', body: '몬스터는 가장자리 길을 계속 돌아요. 필드의 몬스터가 100을 넘으면 패배! 50웨이브의 최종 보스를 쓰러뜨리면 승리예요.' },
];

export function HowToPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Popup visible={visible} title="게임 방법" onClose={onClose}>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
        {STEPS.map((s) => (
          <View key={s.title} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: s.color }]}>
              <Icon name={s.icon} size={22} color="#10152e" />
            </View>
            <View style={{ flex: 1 }}>
              <GText size={17} color={s.color}>
                {s.title}
              </GText>
              <GText size={13} color={C.sub}>
                {s.body}
              </GText>
            </View>
          </View>
        ))}
        <GText size={12} color={C.dim} style={{ textAlign: 'center' }}>
          팁: 유닛을 꾹 눌러 끌면 칸을 옮기거나 서로 바꿀 수 있어요.
        </GText>
      </ScrollView>
      <GButton label="알겠어요!" variant="primary" height={48} onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, padding: 8, borderRadius: 14, backgroundColor: C.panelLo },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
