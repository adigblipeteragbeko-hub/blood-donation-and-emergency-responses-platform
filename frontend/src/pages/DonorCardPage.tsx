import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type DonorProfile = {
  donorNumber?: string;
  fullName?: string;
  phone?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  signature?: string;
  passportPhotoUrl?: string;
  location?: string;
  postalAddress?: string;
  user?: { createdAt?: string; email?: string };
};

export default function DonorCardPage() {
  const [profile, setProfile] = useState<DonorProfile>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/donors/profile');
        setProfile((response.data?.data ?? {}) as DonorProfile);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const userEmail = useMemo(() => {
    const raw = localStorage.getItem('user');
    if (!raw) {
      return '';
    }
    try {
      const parsed = JSON.parse(raw) as { email?: string };
      return parsed.email ?? '';
    } catch {
      return '';
    }
  }, []);

  const cardTelephone = profile.phone || profile.emergencyContactPhone || '-';
  const cardIssuedDate = profile.user?.createdAt ? new Date(profile.user.createdAt).toLocaleDateString() : '-';

  const uploadPassportPhoto = (file?: File) => {
    if (!file) {
      return;
    }

    const processAndUpload = async () => {
      const fileToDataUrl = (input: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(input);
        });

      const downscaleImage = (source: string) =>
        new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const maxSide = 900;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas not available'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.onerror = () => reject(new Error('Invalid image'));
          img.src = source;
        });

      setUploading(true);
      setMessage('');
      setError('');
      try {
        const rawDataUrl = await fileToDataUrl(file);
        const optimizedDataUrl = await downscaleImage(rawDataUrl);
        let updated: DonorProfile | null = null;
        try {
          const response = await api.patch('/donors/profile/passport-photo', { passportPhotoUrl: optimizedDataUrl });
          updated = (response.data?.data ?? response.data) as DonorProfile;
        } catch (patchErr: any) {
          if (patchErr?.response?.status !== 404) {
            throw patchErr;
          }
          const fallbackPayload = {
            fullName: profile.fullName ?? '',
            phone: profile.phone ?? undefined,
            dateOfBirth: profile.dateOfBirth ? `${profile.dateOfBirth}`.slice(0, 10) : undefined,
            bloodGroup: profile.bloodGroup ?? '',
            location: profile.location ?? '',
            postalAddress: profile.postalAddress ?? undefined,
            signature: profile.signature ?? undefined,
            passportPhotoUrl: optimizedDataUrl,
            eligibilityStatus: true,
            availabilityStatus: false,
            emergencyContactName: profile.fullName ?? 'Emergency Contact',
            emergencyContactPhone: profile.emergencyContactPhone ?? profile.phone ?? '+233000000000',
            notificationEmailEnabled: true,
            notificationSmsEnabled: false,
          };
          const fallbackResponse = await api.post('/donors/profile', fallbackPayload);
          updated = (fallbackResponse.data?.data ?? fallbackResponse.data) as DonorProfile;
        }
        setProfile((prev) => ({ ...prev, ...(updated ?? {}), passportPhotoUrl: optimizedDataUrl }));
        setMessage('Passport photo uploaded.');
      } catch (err: any) {
        const apiError = err?.response?.data?.error;
        const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
        setError(extracted ?? err?.message ?? 'Could not upload passport photo. Please try again.');
      } finally {
        setUploading(false);
      }
    };

    void processAndUpload();
  };

  if (loading) {
    return <section className="card">Loading donor card...</section>;
  }

  return (
    <section className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #donor-card-print, #donor-card-print * { visibility: visible; }
          #donor-card-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            border-width: 2px;
          }
        }
      `}</style>
      <div className="card flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-primary">Digital Donor Card</h1>
          <p className="text-sm text-muted">Use print for a compact card copy similar to your physical donor card.</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()} type="button">
          Print Card
        </button>
      </div>

      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700 print:hidden">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700 print:hidden">{error}</p> : null}

      <div id="donor-card-print" className="mx-auto max-w-2xl rounded-xl border-4 border-red-500 bg-white p-4 print:border-2">
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <div className="h-40 w-full rounded border border-dashed p-1">
            {profile.passportPhotoUrl ? (
              <img src={profile.passportPhotoUrl} alt="Donor passport" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-gray-500">FIX PASSPORT PHOTO HERE</div>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">NAME:</span> {profile.fullName || '-'}
            </p>
            <p>
              <span className="font-semibold">TELEPHONE:</span> {cardTelephone}
            </p>
            <p>
              <span className="font-semibold">BLOOD GROUP:</span> {profile.bloodGroup || '-'}
            </p>
            <p>
              <span className="font-semibold">DATE OF BIRTH:</span> {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : '-'}
            </p>
            <p>
              <span className="font-semibold">SIGNATURE:</span> {profile.signature || '-'}
            </p>
            <p>
              <span className="font-semibold">DONOR SERIAL NUMBER:</span> {profile.donorNumber || '-'}
            </p>
            <p>
              <span className="font-semibold">DATE ISSUED:</span> {cardIssuedDate}
            </p>
          </div>
        </div>
        <div className="mt-2 print:hidden">
          <label className="block text-xs font-semibold text-gray-700">
            Upload Passport Photo
            <input
              className="mt-1 w-full rounded border p-2 text-xs"
              type="file"
              accept="image/*"
              onChange={(e) => uploadPassportPhoto(e.target.files?.[0])}
              disabled={uploading}
            />
          </label>
          <p className="mt-1 text-xs text-gray-600">
            Upload from this device, or leave placeholder and attach photo manually after printing.
          </p>
        </div>

        <div className="mt-4 rounded border bg-gray-50 p-3 text-sm">
          <p>
            <span className="font-semibold">E-mail:</span> {userEmail || '-'}
          </p>
          <p>
            <span className="font-semibold">Physical / Postal Address:</span> {profile.postalAddress || profile.location || '-'}
          </p>
          <p className="mt-2 text-xs italic text-gray-600">Please present this card each time you come to give blood.</p>
        </div>
      </div>
    </section>
  );
}
