import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { confirmedBloodGroups } from '../constants/blood-groups';
import { BloodGroup, PriorityLevel, RequestSource, createHospitalRequest, getHospitalProfile } from '../services/hospital-portal';
import { useToast } from '../components/ui/ToastProvider';

const expiryOptions = [
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' },
  { label: '2 hours', value: '120' },
  { label: '4 hours', value: '240' },
  { label: '6 hours', value: '360' },
  { label: '12 hours', value: '720' },
  { label: '24 hours', value: '1440' },
  { label: 'Custom duration', value: 'custom' },
] as const;

function defaultRequiredBy() {
  const date = new Date();
  date.setHours(date.getHours() + 12);
  return date.toISOString().slice(0, 16);
}

export default function HospitalRequestBloodPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const donorContextId = searchParams.get('donorId') ?? '';
  const bloodGroupContext = searchParams.get('bloodGroup') as BloodGroup | null;
  const [patientName, setPatientName] = useState('');
  const [hospitalPatientReference, setHospitalPatientReference] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(
    bloodGroupContext && confirmedBloodGroups.some((group) => group.value === bloodGroupContext)
      ? bloodGroupContext
      : 'O_POS',
  );
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [requestType, setRequestType] = useState<'STANDARD' | 'EMERGENCY'>(donorContextId ? 'EMERGENCY' : 'STANDARD');
  const [priority, setPriority] = useState<PriorityLevel>(donorContextId ? 'HIGH' : 'MEDIUM');
  const [requestSource, setRequestSource] = useState<RequestSource>('DONORS_AND_HOSPITALS');
  const [ward, setWard] = useState('');
  const [location, setLocation] = useState('');
  const [profileHospitalName, setProfileHospitalName] = useState('');
  const [emergencyCity, setEmergencyCity] = useState('');
  const [emergencyRegion, setEmergencyRegion] = useState('');
  const [emergencyLatitude, setEmergencyLatitude] = useState<number | null>(null);
  const [emergencyLongitude, setEmergencyLongitude] = useState<number | null>(null);
  const [notificationExpiry, setNotificationExpiry] = useState('120');
  const [customExpiryValue, setCustomExpiryValue] = useState(2);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<'minutes' | 'hours'>('hours');
  const [requiredBy, setRequiredBy] = useState(defaultRequiredBy());
  const [notes, setNotes] = useState(donorContextId ? `Map donor context: ${donorContextId}` : '');
  const [message, setMessage] = useState('');
  const [loadingProfileLocation, setLoadingProfileLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const emergencyLocationReady = Boolean(
    emergencyCity.trim() && emergencyRegion.trim() && emergencyLatitude !== null && emergencyLongitude !== null,
  );

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getHospitalProfile();
        setProfileHospitalName(profile.hospitalName ?? '');
        if (!donorContextId) {
          setLocation(profile.city?.trim() || profile.location?.trim() || '');
        }
        const city = profile.city?.trim() ?? '';
        const region = profile.region?.trim() ?? '';
        const latitude = typeof profile.latitude === 'number' ? profile.latitude : null;
        const longitude = typeof profile.longitude === 'number' ? profile.longitude : null;
        if (city && region && latitude !== null && longitude !== null) {
          setEmergencyCity(city);
          setEmergencyRegion(region);
          setEmergencyLatitude(latitude);
          setEmergencyLongitude(longitude);
          setMessage((current) =>
            current === 'Hospital profile location is incomplete. Please update Hospital Profile before submitting emergency requests.'
              ? ''
              : current,
          );
        } else if (requestType === 'EMERGENCY') {
          setMessage('Hospital profile location is incomplete. Please update Hospital Profile before submitting emergency requests.');
        }
      } catch {
        // keep empty; user can type location
      }
    };
    void load();
  }, [donorContextId, requestType]);

  const applyHospitalProfileLocation = async () => {
    setLoadingProfileLocation(true);
    setMessage('');
    try {
      const profile = await getHospitalProfile();
      const city = profile.city?.trim() ?? '';
      const region = profile.region?.trim() ?? '';
      const latitude = typeof profile.latitude === 'number' ? profile.latitude : null;
      const longitude = typeof profile.longitude === 'number' ? profile.longitude : null;

      if (!city || !region || latitude === null || longitude === null) {
        setMessage('Hospital profile location is incomplete. Please update Hospital Profile first.');
        return;
      }

      setProfileHospitalName(profile.hospitalName ?? '');
      setEmergencyCity(city);
      setEmergencyRegion(region);
      setEmergencyLatitude(latitude);
      setEmergencyLongitude(longitude);
      setLocation(city || profile.location?.trim() || location);
      toast.info('Hospital profile location applied.');
    } catch {
      const text = 'Unable to load hospital profile location. Please try again.';
      setMessage(text);
      toast.error(text);
    } finally {
      setLoadingProfileLocation(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const trimmedWard = ward.trim();
      const trimmedLocation = location.trim();

      if (!trimmedWard) {
        setMessage('Ward / Unit is required.');
        return;
      }

      if (!trimmedLocation) {
        setMessage('Location is required.');
        return;
      }

      if (
        requestType === 'EMERGENCY' &&
        (!emergencyCity.trim() || !emergencyRegion.trim() || emergencyLatitude === null || emergencyLongitude === null)
      ) {
        setMessage('Use Hospital Profile Location or update Hospital Profile before submitting.');
        return;
      }

      const emergencyNotificationDurationMinutes =
        requestType === 'EMERGENCY'
          ? notificationExpiry === 'custom'
            ? Math.max(1, customExpiryValue) * (customExpiryUnit === 'hours' ? 60 : 1)
            : Number(notificationExpiry)
          : undefined;
      if (emergencyNotificationDurationMinutes && emergencyNotificationDurationMinutes > 24 * 60) {
        setMessage('Notification expiry cannot exceed 24 hours.');
        return;
      }

      const request = await createHospitalRequest({
        patientName: patientName || undefined,
        hospitalPatientReference: hospitalPatientReference || undefined,
        ward: trimmedWard,
        bloodGroup,
        unitsNeeded,
        type: requestType,
        priority,
        requestSource,
        location: trimmedLocation,
        emergencyLocation: requestType === 'EMERGENCY' ? `${trimmedWard}, ${trimmedLocation}` : undefined,
        city: requestType === 'EMERGENCY' ? emergencyCity.trim() : undefined,
        region: requestType === 'EMERGENCY' ? emergencyRegion.trim() : undefined,
        latitude: requestType === 'EMERGENCY' ? emergencyLatitude ?? undefined : undefined,
        longitude: requestType === 'EMERGENCY' ? emergencyLongitude ?? undefined : undefined,
        emergencyNotificationDurationMinutes,
        requiredBy: new Date(requiredBy).toISOString(),
        notes,
      });
      const requestIncludesHospitals = requestSource !== 'DONORS_ONLY';
      toast.success(
        requestType === 'EMERGENCY'
          ? `Emergency blood request created successfully. Reference: ${request.requestReference}.`
          : requestIncludesHospitals
            ? `Blood transfer request sent successfully. Reference: ${request.requestReference}.`
            : `Blood request created successfully. Reference: ${request.requestReference}.`,
      );
      setPatientName('');
      setHospitalPatientReference('');
      setWard('');
      setUnitsNeeded(1);
      setRequestType('STANDARD');
      setPriority('MEDIUM');
      setRequestSource('DONORS_AND_HOSPITALS');
      setNotificationExpiry('120');
      setCustomExpiryValue(2);
      setCustomExpiryUnit('hours');
      setRequiredBy(defaultRequiredBy());
      setNotes('');
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Failed to create request.';
      setMessage(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Request Blood</h1>
        <p className="text-sm text-muted">Create blood requests with quantity, urgency, and coordination details.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
          Request Reference: Will be generated automatically
        </div>
        <label className="text-sm font-semibold">
          Patient Name
          <input
            className="legacy-input mt-1"
            maxLength={120}
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Hospital Patient Reference (Optional)
          <input
            className="legacy-input mt-1"
            maxLength={64}
            placeholder="Optional internal reference"
            type="text"
            value={hospitalPatientReference}
            onChange={(e) => setHospitalPatientReference(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units Needed
          <input
            className="legacy-input mt-1"
            min={1}
            required
            type="number"
            value={unitsNeeded}
            onChange={(e) => setUnitsNeeded(Number(e.target.value))}
          />
        </label>
        <label className="text-sm font-semibold">
          Request Type
          <select
            className="legacy-input mt-1"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as 'STANDARD' | 'EMERGENCY')}
          >
            <option value="STANDARD">STANDARD</option>
            <option value="EMERGENCY">EMERGENCY</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Priority
          <select className="legacy-input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as PriorityLevel)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </label>
        {requestType === 'EMERGENCY' ? (
          <>
            <label className="text-sm font-semibold">
              Notification Expiry
              <select className="legacy-input mt-1" value={notificationExpiry} onChange={(e) => setNotificationExpiry(e.target.value)}>
                {expiryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {notificationExpiry === 'custom' ? (
              <div className="grid gap-2 text-sm font-semibold sm:grid-cols-[1fr_auto]">
                <label>
                  Custom Duration
                  <input
                    className="legacy-input mt-1"
                    min={1}
                    max={customExpiryUnit === 'hours' ? 24 : 1440}
                    required
                    type="number"
                    value={customExpiryValue}
                    onChange={(e) => setCustomExpiryValue(Number(e.target.value))}
                  />
                </label>
                <label>
                  Unit
                  <select className="legacy-input mt-1" value={customExpiryUnit} onChange={(e) => setCustomExpiryUnit(e.target.value as 'minutes' | 'hours')}>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </label>
              </div>
            ) : null}
          </>
        ) : null}
        <label className="text-sm font-semibold md:col-span-2">
          Ward / Unit *
          <input
            className="legacy-input mt-1"
            maxLength={100}
            placeholder="Trauma Ward, ICU, Emergency Unit, Male Surgical Ward"
            required
            type="text"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Enter the hospital ward or unit requesting the blood. Keep the location field for the city or area.
          </p>
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Request Source
          <select
            className="legacy-input mt-1"
            value={requestSource}
            onChange={(e) => setRequestSource(e.target.value as RequestSource)}
          >
            <option value="DONORS_ONLY">Donors Only</option>
            <option value="HOSPITALS_ONLY">Hospitals Only</option>
            <option value="DONORS_AND_HOSPITALS">Donors + Hospitals</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Donors Only: notify approved compatible donors. Hospitals Only: search hospital/blood-bank stock. Donors + Hospitals: fastest dual coordination.
          </p>
        </label>
        <label className="text-sm font-semibold">
          Required By
          <input
            className="legacy-input mt-1"
            required
            type="datetime-local"
            value={requiredBy}
            onChange={(e) => setRequiredBy(e.target.value)}
          />
        </label>
        <div className="text-sm font-semibold md:col-span-2">
          Location
          <input
            className="legacy-input mt-1"
            placeholder="Accra"
            required
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Use the city, town, or area only. Example: Accra.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loadingProfileLocation}
              type="button"
              onClick={applyHospitalProfileLocation}
            >
              {loadingProfileLocation ? 'Loading profile location...' : 'Use Hospital Profile Location'}
            </button>
            {emergencyLocationReady ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Emergency location ready: {emergencyCity}, {emergencyRegion}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Emergency requests need saved city, region, latitude, and longitude.
              </span>
            )}
          </div>
          {emergencyLatitude !== null && emergencyLongitude !== null ? (
            <p className="mt-2 text-xs text-slate-500">
              Coordinates: {emergencyLatitude.toFixed(4)}, {emergencyLongitude.toFixed(4)}
            </p>
          ) : null}
          {requestType === 'EMERGENCY' && emergencyLocationReady ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-black">Emergency Location Ready</p>
              <p className="mt-1">
                {profileHospitalName || 'Hospital'} - {emergencyCity}, {emergencyRegion}
              </p>
              <p className="text-xs font-semibold">Coordinates available for emergency coordination.</p>
            </div>
          ) : requestType === 'EMERGENCY' ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Hospital profile location is incomplete. Please update Hospital Profile before submitting emergency requests.
            </div>
          ) : null}
        </div>
        <label className="text-sm font-semibold md:col-span-2">
          Patient / Clinical Notes
          <textarea className="legacy-input mt-1 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Submitting...' : 'Submit Blood Request'}
        </button>
        {message ? <p className="text-sm font-semibold text-primary md:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}
