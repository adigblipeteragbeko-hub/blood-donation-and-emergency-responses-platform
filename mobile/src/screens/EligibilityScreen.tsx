import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { DonorProfile, EligibilityStatus, getDonorEligibilityStatus, getDonorProfile } from '../services/donor';

function formatDate(value?: string | null) { if (!value) return 'Not available'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString(); }

export function EligibilityScreen() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityStatus | null>(null);
  useFocusEffect(useCallback(() => { void Promise.all([getDonorProfile(), getDonorEligibilityStatus().catch(() => null)]).then(([p, e]) => { setProfile(p); setEligibility(e); }); }, []));
  const approved = Boolean(profile?.eligibilityStatus || eligibility?.eligibilityStatus);
  return <Screen><AppCard><Text style={styles.title}>Eligibility</Text><Text style={styles.muted}>Your current donation readiness.</Text></AppCard><AppCard><StatusBadge label={approved ? 'Eligible' : 'Not eligible yet'} tone={approved ? 'success' : 'warning'} /><Text style={styles.detail}>Availability: {profile?.availabilityStatus ? 'Available' : 'Not available'}</Text><Text style={styles.detail}>Last donation: {formatDate(profile?.lastDonationDate ?? eligibility?.lastDonationDate)}</Text><Text style={styles.detail}>Next eligible: {formatDate(profile?.nextEligibilityDate ?? eligibility?.nextEligibilityDate)}</Text><Text style={styles.muted}>{eligibility?.message ?? 'Complete hospital screening before emergency matching becomes active.'}</Text></AppCard></Screen>;
}

const styles = StyleSheet.create({ title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' }, muted: { color: colors.muted, lineHeight: 20 }, detail: { color: colors.ink, fontSize: 15, lineHeight: 24 } });
