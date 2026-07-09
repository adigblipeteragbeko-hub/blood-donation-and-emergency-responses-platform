import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { BloodRequest, getDonorEmergencyRequestById, getDonorEmergencyRequests, respondToBloodRequest } from '../services/emergency';
import { DonorTabsParamList } from '../types/navigation';
import { formatDateTime, formatDistance } from '../utils/format';

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
      <AppCard style={styles.header}>
        <Text style={styles.kicker}>Emergency Donor Response</Text>
        <Text style={styles.title}>Matched Requests</Text>
        <Text style={styles.muted}>Only requests matched to your donor profile appear here.</Text>
      </AppCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <Text style={styles.muted}>Loading emergency requests...</Text> : null}
      {!loading && requests.length === 0 ? <AppCard><Text style={styles.muted}>No matched emergency blood requests at the moment. You will be notified immediately when a compatible emergency request becomes available.</Text></AppCard> : null}

      {requests.map((request) => (
        <Pressable key={request.id} onPress={() => void openDetail(request)} style={[styles.listCard, selected?.id === request.id && styles.listCardActive]}>
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
            <Text style={styles.panelTitle}>Compatibility</Text>
            <Text style={styles.muted}>{selected.donorMatchContext?.compatible === false ? 'This request is no longer compatible with your donor profile.' : 'You are matched to this request based on donor eligibility and blood compatibility.'}</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Your Response</Text>
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
            <Text style={styles.panelTitle}>Notes</Text>
            <Text style={styles.muted}>{selected.notes || selected.locationNotes || 'No additional emergency notes were provided.'}</Text>
          </View>
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primarySoft, borderColor: '#fecaca' },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  titleSmall: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  message: { borderRadius: 14, backgroundColor: colors.successSoft, color: colors.success, padding: 12, fontWeight: '800' },
  listCard: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: '#fff', padding: 14 },
  listCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  requestRef: { color: colors.primaryDark, fontWeight: '900' },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  detail: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  panel: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  panelTitle: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  actions: { gap: 10 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
});
