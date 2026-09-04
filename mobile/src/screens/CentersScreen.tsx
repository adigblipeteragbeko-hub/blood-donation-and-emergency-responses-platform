import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { BLOOD_GROUPS } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { getSmartBloodBanks, SmartBloodBankCenter } from '../services/centers';
import { estimateTravelTime, formatDistance } from '../utils/format';
import { radius, spacing, typography } from '../theme/design';

function centerTypeLabel(value: string) {
  if (value === 'blood_bank') return 'Blood Bank';
  if (value === 'donation_center') return 'Donation Center';
  return 'Hospital';
}

function emergencyTone(level?: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (level === 'critical' || level === 'urgent') return 'danger';
  if (level === 'watch') return 'warning';
  if (level === 'normal') return 'success';
  return 'muted';
}

function sortedCenters(items: SmartBloodBankCenter[]) {
  return [...items].sort((a, b) => {
    const left = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
    const right = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
    return left - right;
  });
}

export function CentersScreen() {
  const [centers, setCenters] = useState<SmartBloodBankCenter[]>([]);
  const [selected, setSelected] = useState<SmartBloodBankCenter | null>(null);
  const [search, setSearch] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = await getSmartBloodBanks({
        search: search.trim() || undefined,
        bloodGroup: bloodGroup || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        radiusKm: coords ? 50 : undefined,
      });
      setCenters(sortedCenters(payload.centers ?? []));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load centers.');
    } finally {
      setLoading(false);
    }
  }, [bloodGroup, coords, search]);

  useEffect(() => { void load(); }, [load]);

  const useMyLocation = async () => {
    setMessage('');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setMessage('Location permission was denied. You can enable it later from your phone settings.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    setMessage('Location applied. Centers will be sorted by distance.');
  };

  const openMap = async (center: SmartBloodBankCenter) => {
    if (typeof center.latitude !== 'number' || typeof center.longitude !== 'number') {
      setMessage('Map coordinates are not available for this center.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${center.latitude},${center.longitude}`;
    await Linking.openURL(url);
  };

  const filteredBloodGroups = useMemo(() => BLOOD_GROUPS.filter((item) => item.value !== 'UNKNOWN'), []);
  const nearestId = centers.find((item) => typeof item.distanceKm === 'number')?.id;

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Centers</Text>
        <Text style={styles.muted}>Find registered hospitals, blood banks, and donation centers.</Text>
      </AppCard>

      <AppCard>
        <TextInput placeholder="Search city, region, or center" placeholderTextColor={colors.mutedOnLight} value={search} onChangeText={setSearch} style={styles.input} />
        <View style={styles.chips}>
          <Text onPress={() => setBloodGroup('')} style={[styles.chip, !bloodGroup && styles.chipActive]}>All</Text>
          {filteredBloodGroups.map((item) => <Text key={item.value} onPress={() => setBloodGroup(item.value)} style={[styles.chip, bloodGroup === item.value && styles.chipActive]}>{item.label}</Text>)}
        </View>
        <View style={styles.actions}>
          <AppButton title="Use My Location" icon="location-outline" variant="outline" onPress={() => void useMyLocation()} />
          <AppButton title="Refresh Centers" icon="refresh-outline" loading={loading} onPress={() => void load()} />
        </View>
      </AppCard>

      <FeedbackMessage message={message} tone={message.includes('Unable') || message.includes('denied') ? 'warning' : 'success'} />
      {!loading && centers.length === 0 ? <EmptyState icon="business-outline" title="No Centers Found" message="Try enabling location or widening your search." /> : null}

      {selected ? (
        <AppCard style={styles.detailCard}>
          <Text style={styles.kicker}>Center Details</Text>
          <Text style={styles.centerName}>{selected.name}</Text>
          <Text style={styles.detail}>{[selected.city, selected.region].filter(Boolean).join(', ') || selected.address || 'Location not recorded'}</Text>
          <Text style={styles.detail}>{formatDistance(selected.distanceKm)}</Text>
          {estimateTravelTime(selected.distanceKm) ? <Text style={styles.detail}>Estimated travel: {estimateTravelTime(selected.distanceKm)}</Text> : null}
          <Text style={styles.muted}>Available groups: {selected.availableBloodGroups?.length ? selected.availableBloodGroups.join(', ') : 'Not published'}</Text>
          <AppButton title="Navigate" icon="navigate-outline" variant="outline" onPress={() => void openMap(selected)} />
        </AppCard>
      ) : null}

      {centers.map((center) => (
        <Pressable key={`${center.source}-${center.id}`} onPress={() => setSelected(center)} style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}>
          <AppCard style={center.id === nearestId ? styles.nearestCard : undefined}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.inlineRow}>
                  <Text style={styles.centerName}>{center.name}</Text>
                  {center.id === nearestId ? <StatusBadge label="Nearest" tone="success" /> : null}
                </View>
                <Text style={styles.muted}>{[center.city, center.region].filter(Boolean).join(', ') || center.address || 'Location not recorded'}</Text>
              </View>
              <StatusBadge label={centerTypeLabel(center.centerType)} tone="primary" />
            </View>
            <View style={styles.metaGrid}>
              <Text style={styles.detail}>Units: {center.totalUnits ?? 0}</Text>
              <Text style={styles.detail}>{formatDistance(center.distanceKm)}</Text>
              {estimateTravelTime(center.distanceKm) ? <Text style={styles.detail}>Travel: {estimateTravelTime(center.distanceKm)}</Text> : null}
            </View>
            <StatusBadge label={`Emergency: ${center.emergencyLevel ?? 'unknown'}`} tone={emergencyTone(center.emergencyLevel)} />
            <View style={styles.chips}>
              {(center.bloodAvailability?.length ? center.bloodAvailability.map((item) => `${item.label ?? item.bloodGroup}: ${item.availableUnits}`) : center.availableBloodGroups ?? []).slice(0, 8).map((item) => <Text key={item} style={styles.smallChip}>{item}</Text>)}
            </View>
          </AppCard>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.borderOnLight, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 15, backgroundColor: colors.white, color: colors.textOnLight },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, color: colors.muted, fontWeight: '800', overflow: 'hidden' },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft, color: colors.primaryDark },
  smallChip: { borderRadius: 999, backgroundColor: colors.primarySoft, color: colors.primaryDark, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  inlineRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  centerName: { color: colors.ink, ...typography.cardTitle },
  detail: { color: colors.ink, ...typography.body },
  actions: { gap: spacing.md },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  detailCard: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  nearestCard: { borderColor: colors.success, backgroundColor: colors.successSoft },
  cardPress: { borderRadius: 18 },
  pressed: { opacity: 0.85 },
});
