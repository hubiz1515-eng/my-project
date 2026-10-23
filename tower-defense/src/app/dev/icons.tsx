import { Image, ScrollView, View, Text } from 'react-native';
import { ENEMIES, type EnemyKind } from '@/game/engine/enemies';
import { UNIT_IDS } from '@/game/engine/units';
import { enemyIcon, unitIcon } from '@/game/render/icons';

export default function IconsDev() {
  const kinds = Object.keys(ENEMIES) as EnemyKind[];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#182042' }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 }}>
      {UNIT_IDS.map((id) => (
        <View key={id} style={{ width: 64, height: 64, backgroundColor: '#232d5c', borderRadius: 10 }}>
          <Image source={{ uri: unitIcon(id, 64) }} style={{ width: 64, height: 64 }} />
        </View>
      ))}
      {kinds.map((k) => (
        <View key={k} style={{ width: 64, height: 64, backgroundColor: '#232d5c', borderRadius: 10 }}>
          <Image source={{ uri: enemyIcon(k, 64) }} style={{ width: 64, height: 64 }} />
        </View>
      ))}
      <Text style={{ color: '#fff' }}>{unitIcon('squire', 64).length}</Text>
    </ScrollView>
  );
}
