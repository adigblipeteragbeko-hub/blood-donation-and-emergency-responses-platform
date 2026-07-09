import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { getDonorLocation, updateDonorLocation } from '../services/location';

export function LocationSettingsScreen() {
  const [sharing, setSharing] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await getDonorLocation();
        setSharing(Boolean(payload.donor?.locationSharingEnabled));
        setLatitude(typeof payload.donor?.latitude === 'number' ? payload.donor.latitude : null);
        setLongitude(typeof payload.donor?.longitude === 'number' ? payload.donor.longitude : null);
        setAccuracy(typeof payload.donor?.accuracyMeters === 'number' ? payload.donor.accuracyMeters : null);
      } catch {
        // Location settings can still be captured even if no saved state exists yet.
      }
    };
    void load();
  }, []);

  const capture = async () => {
    setMessage('');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setMessage('Location permission was denied. You can enable it later from your phone settings.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLatitude(position.coords.latitude);
    setLongitude(position.coords.longitude);
    setAccuracy(position.coords.accuracy ?? null);
    setMessage('Location captured. Save settings to update emergency coordination.');
  };

  const save = async () => {
    setMessage('');
    setLoading(true);
    try {
      await updateDonorLocation({
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        accuracyMeters: accuracy ?? undefined,
        locationSharingEnabled: sharing,
        source: 'mobile',
      });
      setMessage('Location sharing settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save location settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppCard>
        <Text style={styles.title}>Location Sharing Settings</Text>
        <Text style={styles.muted}>Your location is only visible to authorized hospital staff and administrators for emergency coordination. Public users cannot see donor locations.</Text>
      </AppCard>

      <AppCard>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Enable Secure Location Sharing</Text>
            <Text style={styles.muted}>Used only for emergency donor coordination.</Text>
          </View>
          <Switch value={sharing} onValueChange={setSharing} thumbColor={sharing ? colors.primary : undefined} />
        </View>
        <Text style={styles.detail}>Current status: {latitude && longitude ? 'Location captured' : 'Location not captured yet'}</Text>
        <Text style={styles.detail}>Latitude: {latitude?.toFixed(6) ?? 'Captured automatically'}</Text>
        <Text style={styles.detail}>Longitude: {longitude?.toFixed(6) ?? 'Captured automatically'}</Text>
        {accuracy ? <Text style={styles.detail}>Accuracy: {Math.round(accuracy)} meters</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <AppButton title="Use Browser Location" variant="outline" onPress={() => void capture()} />
        <AppButton title="Save Location Settings" loading={loading} onPress={() => void save()} />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  detail: { color: colors.ink, fontSize: 15 },
  message: { borderRadius: 12, backgroundColor: colors.warningSoft, color: colors.warning, padding: 10, fontWeight: '700' },
});
