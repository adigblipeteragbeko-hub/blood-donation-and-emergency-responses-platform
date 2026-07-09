import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { getDonorProfile } from '../services/donor';

const milestones = [1, 5, 10, 25];

function donorLevel(count: number) {
  if (count >= 25) return 'Hero Donor';
  if (count >= 10) return 'Gold Donor';
  if (count >= 5) return 'Silver Donor';
  return 'Bronze Donor';
}

export function RewardsScreen() {
  const [count, setCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getDonorProfile();
      const donationCount = profile.donationHistory?.length ?? 0;
      setCount(donationCount);
      setPoints(profile.rewardPoints ?? donationCount * 100);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const level = useMemo(() => donorLevel(count), [count]);

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard style={styles.hero}>
        <Text style={styles.kicker}>Rewards</Text>
        <Text style={styles.title}>{level}</Text>
        <Text style={styles.muted}>Every completed donation moves you closer to the next donor milestone.</Text>
      </AppCard>
      <View style={styles.grid}>
        <AppCard style={styles.stat}><Text style={styles.big}>{count}</Text><Text style={styles.muted}>Completed donations</Text></AppCard>
        <AppCard style={styles.stat}><Text style={styles.big}>{points}</Text><Text style={styles.muted}>Reward points</Text></AppCard>
      </View>
      <Text style={styles.section}>Badges</Text>
      {milestones.map((item) => (
        <AppCard key={item} style={styles.badge}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.badgeTitle}>{item === 1 ? 'First Donation' : `${item} Donations`}</Text>
              <Text style={styles.muted}>{count >= item ? 'Badge earned. Thank you for showing up.' : `${Math.max(0, item - count)} donation(s) to unlock.`}</Text>
            </View>
            <StatusBadge label={count >= item ? 'Earned' : 'Locked'} tone={count >= item ? 'success' : 'muted'} />
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primarySoft, borderColor: '#fecaca' },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: colors.primaryDark, fontSize: 28, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  big: { color: colors.primaryDark, fontSize: 44, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  badge: { minHeight: 92 },
  badgeTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
});
