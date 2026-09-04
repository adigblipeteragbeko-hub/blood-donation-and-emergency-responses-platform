import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { BloodRequest, getDonorEmergencyRequestById, getDonorEmergencyRequests, respondToBloodRequest } from '../services/emergency';
import { DonorTabsParamList } from '../types/navigation';
import { formatDateTime, formatDistance } from '../utils/format';
import { radius, spacing, typography } from '../theme/design';

function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'muted' | 'primary' {
  if (status === 'FULFILLED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'MATCHING') return 'warning';
  return 'primary';
}

function hasResponded(request?: BloodRequest | null) {
  return Boolean(request?.donorResponses?.some((item) => item.responseStatus && item.responseStatus !== 'PENDING'));
}

function responseLabel(request?: BloodRequest | null) {
  const response = request?.donorResponses?.find((item) => item.responseStatus && item.responseStatus !== 'PENDING');
  if (!response) return '';
  return response.responseStatus === 'ACCEPTED' ? 'I am available' : 'I am unavailable';
}

function canRespond(request?: BloodRequest | null) {
  if (!request) return false;
  if (hasResponded(request)) return false;
  if (request.status === 'FULFILLED' || request.status === 'CANCELLED') return false;
  const context = request.donorMatchContext;
  if (context && (context.compatible === false || context.eligible === false || context.available === false || context.inCooldown === true)) return false;
  return true;
}

export function EmergencyRequestsScreen() {
  const route = useRoute<RouteProp<DonorTabsParamList, 'Emergency'>>();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selected, setSelected] = useState<BloodRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const list = await getDonorEmergencyRequests({ take: 10 });
      setRequests(list);
      const focusId = route.params?.requestId;
      if (focusId) {
        const detail = await getDonorEmergencyRequestById(focusId);
        setSelected(detail);
      } else if (list.length > 0) {
        setSelected(list[0]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load emergency requests.');
    } finally {
      setLoading(false);
    }
  }, [route.params?.requestId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selectedResponse = useMemo(() => responseLabel(selected), [selected]);

  const openDetail = async (request: BloodRequest) => {
    setSelected(request);
    try {
      setSelected(await getDonorEmergencyRequestById(request.id));
    } catch {
      // Keep list item selected if detail refresh fails.
    }
  };

  const submitResponse = async (available: boolean) => {
    if (!selected) return;
    setSubmitting(true);
    setMessage('');
    try {
      await respondToBloodRequest(selected.id, {
        responseStatus: available ? 'ACCEPTED' : 'DECLINED',
        notes: available ? 'Mobile donor response: I am available.' : 'Mobile donor response: I am unavailable.',
      });
      const refreshed = await getDonorEmergencyRequestById(selected.id);
      setSelected(refreshed);
      setRequests((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
      setMessage('Your response has been submitted. Hospital staff can now see your response.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit your response.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard variant="soft" style={styles.header}>
        <Text style={styles.kicker}>Emergency Donor Response</Text>
        <Text style={styles.title}>Matched Requests</Text>
        <Text style={styles.muted}>Only requests matched to your donor profile appear here.</Text>
      </AppCard>

      <FeedbackMessage message={message} tone={message.includes('submitted') ? 'success' : 'warning'} />
      {loading ? <Text style={styles.muted}>Loading emergency requests...</Text> : null}
      {!loading && requests.length === 0 ? (
        <EmptyState
          icon="water-outline"
          title="No Matched Emergency Requests"
          message="You will be notified immediately when a compatible emergency request becomes available."
        />
      ) : null}

      {requests.map((request) => (
        <Pressable key={request.id} onPress={() => void openDetail(request)} style={({ pressed }) => [styles.listCard, selected?.id === request.id && styles.listCardActive, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <Text style={styles.requestRef}>{request.requestReference ?? 'Blood Request'}</Text>
            <StatusBadge label={request.status} tone={statusTone(request.status)} />
          </View>
          <View style={styles.badgeRow}>
            <StatusBadge label={request.priority === 'CRITICAL' ? 'URGENT' : request.priority} tone={request.priority === 'CRITICAL' ? 'danger' : 'warning'} />
            {hasResponded(request) ? <StatusBadge label={`Response: ${responseLabel(request)}`} tone="success" /> : null}
          </View>
          <Text style={styles.cardTitle}>{formatBloodGroup(request.bloodGroup)} | {request.unitsNeeded} unit(s)</Text>
          <Text style={styles.muted}>{request.hospitalCenterName ?? request.hospital?.hospitalName ?? 'Hospital'} - {request.ward ?? request.location ?? 'Location pending'}</Text>
          {typeof request.donorMatchContext?.distanceKm === 'number' ? <Text style={styles.muted}>{formatDistance(request.donorMatchContext.distanceKm)}</Text> : null}
          <Text style={styles.muted}>Required by: {formatDateTime(request.requiredBy)}</Text>
        </Pressable>
      ))}

      {selected ? (
        <AppCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Request Summary</Text>
              <Text style={styles.titleSmall}>{selected.requestReference ?? 'Emergency request'}</Text>
            </View>
            <StatusBadge label={selected.priority} tone={selected.priority === 'CRITICAL' ? 'danger' : 'warning'} />
          </View>
          <Text style={styles.detail}>Hospital: {selected.hospitalCenterName ?? selected.hospital?.hospitalName ?? 'Hospital'}</Text>
          <Text style={styles.detail}>Blood group: {formatBloodGroup(selected.bloodGroup)}</Text>
          <Text style={styles.detail}>Units requested: {selected.unitsNeeded}</Text>
          <Text style={styles.detail}>Ward / Unit: {selected.ward ?? 'Not recorded'}</Text>
          <Text style={styles.detail}>Location: {[selected.location, selected.city, selected.region].filter(Boolean).join(', ') || 'Not recorded'}</Text>
          <Text style={styles.detail}>Required by: {formatDateTime(selected.requiredBy)}</Text>
          {typeof selected.donorMatchContext?.distanceKm === 'number' ? <Text style={styles.detail}>Distance: {formatDistance(selected.donorMatchContext.distanceKm)}</Text> : null}

          <View style={styles.panel}>
            <SectionHeader title="Compatibility" />
            <Text style={styles.muted}>{selected.donorMatchContext?.compatible === false ? 'This request is no longer compatible with your donor profile.' : 'You are matched to this request based on donor eligibility and blood compatibility.'}</Text>
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Your Response" />
            {hasResponded(selected) ? (
              <Text style={styles.success}>Your response has been submitted: {selectedResponse}. Hospital staff can now see your response.</Text>
            ) : selected.status === 'FULFILLED' || selected.status === 'CANCELLED' ? (
              <Text style={styles.muted}>This request is no longer active.</Text>
            ) : canRespond(selected) ? (
              <View style={styles.actions}>
                <AppButton title="I am available" loading={submitting} onPress={() => void submitResponse(true)} />
                <AppButton title="I am unavailable" variant="outline" disabled={submitting} onPress={() => void submitResponse(false)} />
              </View>
            ) : (
              <Text style={styles.muted}>You cannot respond because you are no longer eligible or available for this request.</Text>
            )}
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Notes" />
            <Text style={styles.muted}>{selected.notes || selected.locationNotes || 'No additional emergency notes were provided.'}</Text>
          </View>
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 },
  title: { color: colors.ink, ...typography.screenTitle },
  titleSmall: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.muted, ...typography.body },
  listCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.elevated, padding: spacing.lg },
  listCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  requestRef: { color: colors.primaryDark, fontWeight: '900' },
  cardTitle: { color: colors.ink, ...typography.cardTitle },
  detail: { color: colors.ink, ...typography.body },
  panel: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  actions: { gap: spacing.md },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
  pressed: { opacity: 0.86 },
});
