import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { FilterBox, Pager } from '../components/TableControls';
import { EditModal } from '../components/ui/EditModal';
import { AsyncTypeahead, TypeaheadSuggestion } from '../components/ui/AsyncTypeahead';
import { countryCodes } from '../constants/country-codes';
import {
  adminCorrectCompletionEvidence,
  BloodRequestItem,
  DonorResponseStatus,
  InventoryLogItem,
  RequestProgressStatus,
  createBloodRequestUpdate,
  getAllBloodRequests,
  getInventoryLogs,
  getTypeaheadSuggestions,
  updateDonorResponse,
} from '../services/hospital-portal';

type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'DONOR'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'INVENTORY_OFFICER'
  | 'DONOR_REVIEW_OFFICER'
  | 'WEBSITE_CONTENT_ADMIN'
  | 'AUDITOR';

type UserItem = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
};

type DonorItem = {
  id: string;
  donorNumber?: string;
  fullName: string;
  bloodGroup: string;
  location: string;
  availabilityStatus: boolean;
  eligibilityStatus: boolean;
  user: { id: string; email: string; role: Role; isActive: boolean };
};

type HospitalItem = {
  id: string;
  hospitalName: string;
  registrationCode: string;
  location: string;
  contactName: string;
  contactPhone: string;
  user: { id: string; email: string; role: Role; isActive: boolean };
};

const bloodGroups = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];
const formatRole = (role: Role) =>
  role
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
const adminAssignableRoles: Role[] = [
  'ADMIN',
  'WEBSITE_CONTENT_ADMIN',
  'AUDITOR',
  'DONOR',
  'HOSPITAL_ADMIN',
  'HOSPITAL_STAFF',
  'INVENTORY_OFFICER',
  'DONOR_REVIEW_OFFICER',
];
const bloodGroupLabel: Record<string, string> = {
  O_POS: 'O_POS (O+)',
  O_NEG: 'O_NEG (O-)',
  A_POS: 'A_POS (A+)',
  A_NEG: 'A_NEG (A-)',
  B_POS: 'B_POS (B+)',
  B_NEG: 'B_NEG (B-)',
  AB_POS: 'AB_POS (AB+)',
  AB_NEG: 'AB_NEG (AB-)',
};
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const nameRule = /^[A-Za-z\s'-]+$/;
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminManagementPage() {
  const location = useLocation();
  const activeSection =
    new URLSearchParams(location.search).get('section') || location.hash?.replace('#', '') || 'settings';
  const [users, setUsers] = useState<UserItem[]>([]);
  const [donors, setDonors] = useState<DonorItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestTracking, setRequestTracking] = useState<BloodRequestItem[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([]);
  const [completionCorrection, setCompletionCorrection] = useState<
    Record<string, { transfusedByStaffId: string; unitDin: string; patientEncounterId: string; overrideReason: string }>
  >({});

  const [accountRole, setAccountRole] = useState<Role>('DONOR');
  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
    fullName: '',
    bloodGroup: '',
    location: '',
    eligibilityStatus: true,
    availabilityStatus: true,
    emergencyContactName: '',
    emergencyContactCode: '+233',
    emergencyContactPhone: '',
    hospitalName: '',
    registrationCode: '',
    address: '',
    contactName: '',
    contactCode: '+233',
    contactPhone: '',
  });
  const [editingUser, setEditingUser] = useState<{ id: string; role: Role; isActive: boolean } | null>(null);
  const [editingDonor, setEditingDonor] = useState<{
    id: string;
    donorNumber: string;
    fullName: string;
    location: string;
    bloodGroup: string;
  } | null>(null);
  const [editingHospital, setEditingHospital] = useState<{
    id: string;
    hospitalName: string;
    location: string;
    contactName: string;
  } | null>(null);
  const [usersPage, setUsersPage] = useState(0);
  const [donorsPage, setDonorsPage] = useState(0);
  const [hospitalsPage, setHospitalsPage] = useState(0);
  const [requestsPage, setRequestsPage] = useState(0);
  const [inventoryLogsPage, setInventoryLogsPage] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [hasMoreDonors, setHasMoreDonors] = useState(false);
  const [hasMoreHospitals, setHasMoreHospitals] = useState(false);
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const [hasMoreInventoryLogs, setHasMoreInventoryLogs] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [savingModal, setSavingModal] = useState(false);
  const [compactDensity, setCompactDensity] = useState(false);

  const loadUsers = async (page = usersPage) => {
    const skip = page * PAGE_SIZE;
    const usersRes = await api.get('/users', { params: { skip, take: PAGE_SIZE } });
    const data: UserItem[] = usersRes.data.data ?? [];
    setUsers(data);
    setHasMoreUsers(data.length === PAGE_SIZE);
  };

  const loadDonors = async (page = donorsPage) => {
    const skip = page * PAGE_SIZE;
    const donorsRes = await api.get('/donors/admin', { params: { skip, take: PAGE_SIZE } });
    const data: DonorItem[] = donorsRes.data.data ?? [];
    setDonors(data);
    setHasMoreDonors(data.length === PAGE_SIZE);
  };

  const loadHospitals = async (page = hospitalsPage) => {
    const skip = page * PAGE_SIZE;
    const hospitalsRes = await api.get('/hospitals/admin', { params: { skip, take: PAGE_SIZE } });
    const data: HospitalItem[] = hospitalsRes.data.data ?? [];
    setHospitals(data);
    setHasMoreHospitals(data.length === PAGE_SIZE);
  };

  const loadRequests = async (page = requestsPage) => {
    const skip = page * PAGE_SIZE;
    const data = await getAllBloodRequests({ skip, take: PAGE_SIZE });
    setRequestTracking(data);
    setHasMoreRequests(data.length === PAGE_SIZE);
  };

  const loadInventoryLogData = async (page = inventoryLogsPage) => {
    const skip = page * PAGE_SIZE;
    const data = await getInventoryLogs({ skip, take: PAGE_SIZE });
    setInventoryLogs(data);
    setHasMoreInventoryLogs(data.length === PAGE_SIZE);
  };

  const loadSectionData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeSection === 'settings') {
        await loadUsers();
      } else if (activeSection === 'donors') {
        await loadDonors();
      } else if (activeSection === 'hospitals') {
        await loadHospitals();
      } else if (activeSection === 'request-tracking') {
        await loadRequests();
      } else if (activeSection === 'inventory-tracking') {
        await loadInventoryLogData();
      }
    } catch {
      setError('Failed to load admin data. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrentSection = async () => {
    await loadSectionData();
  };

  const addTrackingUpdate = async (requestId: string, newStatus: RequestProgressStatus) => {
    try {
      await createBloodRequestUpdate(requestId, { newStatus });
      setError('');
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not add tracking update.');
    }
  };

  const applyCompletionCorrection = async (requestId: string) => {
    const correction = completionCorrection[requestId];
    if (
      !correction?.transfusedByStaffId?.trim() ||
      !correction?.unitDin?.trim() ||
      !correction?.patientEncounterId?.trim() ||
      !correction?.overrideReason?.trim()
    ) {
      setError('Admin correction requires staff ID, unit DIN, patient encounter ID, and override reason.');
      return;
    }
    try {
      await adminCorrectCompletionEvidence(requestId, {
        transfusedByStaffId: correction.transfusedByStaffId.trim(),
        unitDin: correction.unitDin.trim(),
        patientEncounterId: correction.patientEncounterId.trim(),
        overrideReason: correction.overrideReason.trim(),
      });
      setError('');
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not apply completion correction.');
    }
  };

  const patchDonorResponse = async (responseId: string, responseStatus: DonorResponseStatus) => {
    try {
      await updateDonorResponse(responseId, { responseStatus });
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update donor response.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void refreshCurrentSection();
  }, [activeSection, usersPage, donorsPage, hospitalsPage, requestsPage, inventoryLogsPage]);

  const resetAccountForm = () => {
    setAccountForm({
      email: '',
      password: '',
      fullName: '',
      bloodGroup: '',
      location: '',
      eligibilityStatus: true,
      availabilityStatus: true,
      emergencyContactName: '',
      emergencyContactCode: '+233',
      emergencyContactPhone: '',
      hospitalName: '',
      registrationCode: '',
      address: '',
      contactName: '',
      contactCode: '+233',
      contactPhone: '',
    });
  };

  useEffect(() => {
    resetAccountForm();
  }, [accountRole]);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordRule.test(accountForm.password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and special character.');
      return;
    }
    if (accountRole === 'DONOR' && (!nameRule.test(accountForm.fullName) || !nameRule.test(accountForm.emergencyContactName))) {
      setError('Donor name fields must contain letters only.');
      return;
    }
    if (accountRole === 'HOSPITAL_ADMIN' && !nameRule.test(accountForm.contactName)) {
      setError('Contact name must contain letters only.');
      return;
    }

    try {
      if (['ADMIN', 'WEBSITE_CONTENT_ADMIN', 'AUDITOR'].includes(accountRole)) {
        await api.post('/users', {
          email: accountForm.email,
          password: accountForm.password,
          role: accountRole,
          isActive: true,
        });
      }

      if (accountRole === 'DONOR') {
        await api.post('/donors/admin', {
          email: accountForm.email,
          password: accountForm.password,
          fullName: accountForm.fullName,
          bloodGroup: accountForm.bloodGroup,
          location: accountForm.location,
          eligibilityStatus: accountForm.eligibilityStatus,
          availabilityStatus: accountForm.availabilityStatus,
          emergencyContactName: accountForm.emergencyContactName,
          emergencyContactPhone: `${accountForm.emergencyContactCode}${accountForm.emergencyContactPhone}`,
        });
      }

      if (accountRole === 'HOSPITAL_ADMIN') {
        await api.post('/hospitals/admin', {
          email: accountForm.email,
          password: accountForm.password,
          hospitalName: accountForm.hospitalName,
          registrationCode: accountForm.registrationCode,
          address: accountForm.address,
          location: accountForm.location,
          contactName: accountForm.contactName,
          contactPhone: `${accountForm.contactCode}${accountForm.contactPhone}`,
        });
      }

      resetAccountForm();
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not create account. Check required fields for selected account type.');
    }
  };

  const editUser = (user: UserItem) => {
    setEditingUser({ id: user.id, role: user.role, isActive: user.isActive });
  };

  const updateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) {
      return;
    }
    try {
      await api.patch(`/users/${editingUser.id}`, {
        role: editingUser.role,
        isActive: editingUser.isActive,
      });
      setEditingUser(null);
      await refreshCurrentSection();
    } catch {
      setError('Could not update user.');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      await refreshCurrentSection();
    } catch {
      setError('Could not delete user.');
    }
  };

  const editDonor = (donor: DonorItem) => {
    setEditingDonor({
      id: donor.id,
      donorNumber: donor.donorNumber ?? '',
      fullName: donor.fullName,
      location: donor.location,
      bloodGroup: donor.bloodGroup,
    });
  };

  const updateDonor = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDonor) {
      return;
    }
    try {
      await api.patch(`/donors/admin/${editingDonor.id}`, {
        fullName: editingDonor.fullName,
        location: editingDonor.location,
        bloodGroup: editingDonor.bloodGroup,
      });
      setEditingDonor(null);
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update donor.');
    }
  };

  const deleteDonor = async (id: string) => {
    if (!confirm('Delete this donor?')) {
      return;
    }

    try {
      await api.delete(`/donors/admin/${id}`);
      await refreshCurrentSection();
    } catch {
      setError('Could not delete donor.');
    }
  };

  const setDonorApproval = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/donors/admin/${id}/eligibility`, { approved });
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update donor approval.');
    }
  };

  const editHospital = (hospital: HospitalItem) => {
    setEditingHospital({
      id: hospital.id,
      hospitalName: hospital.hospitalName,
      location: hospital.location,
      contactName: hospital.contactName,
    });
  };

  const updateHospital = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingHospital) {
      return;
    }
    try {
      await api.patch(`/hospitals/admin/${editingHospital.id}`, {
        hospitalName: editingHospital.hospitalName,
        location: editingHospital.location,
        contactName: editingHospital.contactName,
      });
      setEditingHospital(null);
      await refreshCurrentSection();
    } catch {
      setError('Could not update hospital.');
    }
  };

  const deleteHospital = async (id: string) => {
    if (!confirm('Delete this hospital?')) {
      return;
    }

    try {
      await api.delete(`/hospitals/admin/${id}`);
      await refreshCurrentSection();
    } catch {
      setError('Could not delete hospital.');
    }
  };

  const includesTerm = (value: string | undefined | null) =>
    !searchTerm || (value ?? '').toLowerCase().includes(searchTerm);

  const filteredUsers = users.filter(
    (user) => includesTerm(user.email) || includesTerm(formatRole(user.role)) || includesTerm(String(user.isActive)),
  );
  const filteredDonors = donors.filter(
    (donor) =>
      includesTerm(donor.donorNumber) ||
      includesTerm(donor.fullName) ||
      includesTerm(donor.user.email) ||
      includesTerm(donor.location) ||
      includesTerm(donor.bloodGroup),
  );
  const filteredHospitals = hospitals.filter(
    (hospital) =>
      includesTerm(hospital.hospitalName) ||
      includesTerm(hospital.user.email) ||
      includesTerm(hospital.registrationCode) ||
      includesTerm(hospital.location),
  );
  const filteredRequests = requestTracking.filter(
    (request) =>
      includesTerm(request.hospital?.hospitalName) ||
      includesTerm(request.bloodGroup) ||
      includesTerm(request.status) ||
      includesTerm(request.trackingStatus) ||
      includesTerm(String(request.unitsNeeded)),
  );
  const filteredInventoryLogs = inventoryLogs.filter(
    (log) =>
      includesTerm(log.inventory.hospital?.hospitalName) ||
      includesTerm(log.inventory.bloodGroup) ||
      includesTerm(log.changeType) ||
      includesTerm(log.changedBy?.email),
  );

  const handleUserModalSubmit = async (event: FormEvent) => {
    setSavingModal(true);
    await updateUser(event);
    setSavingModal(false);
  };

  const handleDonorModalSubmit = async (event: FormEvent) => {
    setSavingModal(true);
    await updateDonor(event);
    setSavingModal(false);
  };

  const handleHospitalModalSubmit = async (event: FormEvent) => {
    setSavingModal(true);
    await updateHospital(event);
    setSavingModal(false);
  };

  return (
    <section className="space-y-6 pt-2 md:pt-3">
      <h1 className="text-2xl font-bold text-primary">Admin Control Center</h1>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-muted">Loading data...</p>}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCompactDensity((current) => !current)}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-red-200 hover:text-primary"
        >
          Density: {compactDensity ? 'Compact' : 'Comfortable'}
        </button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <FilterBox
          label="Search (debounced)"
          placeholder="Filter current tab..."
          value={searchInput}
          onChange={setSearchInput}
        />
        <AsyncTypeahead
          label="Smart typeahead search"
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search donor, hospital, blood group, location, emergency..."
          loadSuggestions={async (query): Promise<TypeaheadSuggestion[]> => {
            const payload = await getTypeaheadSuggestions(query);
            return [
              ...payload.hospitals.map((item) => ({ id: `h-${item.id}`, label: item.hospitalName, description: item.location, category: 'Hospital' })),
              ...payload.donors.map((item) => ({ id: `d-${item.id}`, label: item.fullName, description: `${item.bloodGroup} • ${item.location}`, category: 'Donor' })),
              ...payload.bloodGroups.map((item) => ({ id: `b-${item}`, label: item, category: 'Blood' })),
              ...payload.locations.map((item, index) => ({ id: `l-${index}`, label: item, category: 'Location' })),
              ...payload.emergencyRequests.map((item) => ({ id: `e-${item.id}`, label: `${item.bloodGroup} • ${item.unitsNeeded}u`, description: item.location, category: 'Emergency' })),
              ...payload.inventory.map((item) => ({ id: `i-${item.id}`, label: `${item.bloodGroup} • ${item.availableUnits}u`, description: item.hospital.hospitalName, category: 'Inventory' })),
            ];
          }}
          onSelect={(item) => setSearchInput(item.value ?? item.label)}
        />
      </div>

      {activeSection === 'settings' ? (
      <form className="card space-y-3" onSubmit={createAccount} autoComplete="off">
        <h2 className="text-xl font-semibold">Add Account</h2>
        <p className="text-sm text-muted">Create donor, hospital-admin, and delegated administrative accounts.</p>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold">
            Account Type
            <select
              className="mt-1 w-full rounded border p-2"
              value={accountRole}
              onChange={(e) => setAccountRole(e.target.value as Role)}
            >
              <option value="DONOR">Donor</option>
              <option value="HOSPITAL_ADMIN">Hospital Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="WEBSITE_CONTENT_ADMIN">Website Content Admin</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </label>

          <label className="text-sm font-semibold">
            Email
            <input
              className="mt-1 w-full rounded border p-2"
              placeholder="email@example.com"
              name="admin_create_email"
              autoComplete="off"
              value={accountForm.email}
              onChange={(e) => setAccountForm((v) => ({ ...v, email: e.target.value }))}
              required
            />
          </label>

          <label className="text-sm font-semibold">
            Password
            <input
              className="mt-1 w-full rounded border p-2"
              type="password"
              placeholder="Minimum 8 chars"
              name="admin_create_password"
              autoComplete="new-password"
              value={accountForm.password}
              onChange={(e) => setAccountForm((v) => ({ ...v, password: e.target.value }))}
              required
            />
          </label>
        </div>

        {accountRole === 'DONOR' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Full Name" value={accountForm.fullName} onChange={(e) => setAccountForm((v) => ({ ...v, fullName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <select className="rounded border p-2" value={accountForm.bloodGroup} onChange={(e) => setAccountForm((v) => ({ ...v, bloodGroup: e.target.value }))} required>
              <option value="">Select Blood Group</option>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>
                  {bloodGroupLabel[group]}
                </option>
              ))}
            </select>
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Emergency Contact Name" value={accountForm.emergencyContactName} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select className="rounded border p-2" value={accountForm.emergencyContactCode} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactCode: e.target.value }))}>
                {countryCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input className="rounded border p-2" placeholder="Emergency Contact Number" value={accountForm.emergencyContactPhone} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactPhone: e.target.value.replace(/\D/g, '') }))} pattern="\d+" inputMode="numeric" title="Number field should contain digits only" required />
            </div>
          </div>
        ) : null}

        {accountRole === 'HOSPITAL_ADMIN' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Hospital Name" value={accountForm.hospitalName} onChange={(e) => setAccountForm((v) => ({ ...v, hospitalName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <input className="rounded border p-2" placeholder="Registration Code" value={accountForm.registrationCode} onChange={(e) => setAccountForm((v) => ({ ...v, registrationCode: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Address" value={accountForm.address} onChange={(e) => setAccountForm((v) => ({ ...v, address: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Contact Name" value={accountForm.contactName} onChange={(e) => setAccountForm((v) => ({ ...v, contactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select className="rounded border p-2" value={accountForm.contactCode} onChange={(e) => setAccountForm((v) => ({ ...v, contactCode: e.target.value }))}>
                {countryCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input className="rounded border p-2" placeholder="Contact Number" value={accountForm.contactPhone} onChange={(e) => setAccountForm((v) => ({ ...v, contactPhone: e.target.value.replace(/\D/g, '') }))} pattern="\d+" inputMode="numeric" title="Number field should contain digits only" required />
            </div>
          </div>
        ) : null}

        <button className="btn-primary" type="submit">Create Account</button>
      </form>
      ) : null}

      {activeSection === 'settings' ? (
      <div id="settings" className="card space-y-3">
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
          <table className={`min-w-[680px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b">
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Email</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Role</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Active</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{user.email}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{formatRole(user.role)}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{String(user.isActive)}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editUser(user)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteUser(user.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={usersPage}
          hasMore={hasMoreUsers}
          onPrev={() => setUsersPage((page) => Math.max(0, page - 1))}
          onNext={() => setUsersPage((page) => page + 1)}
        />
        {null}
      </div>
      ) : null}

      {activeSection === 'donors' ? (
      <div id="donors" className="card space-y-3">
        <h2 className="text-xl font-semibold">Donors</h2>
        <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
          <table className={`min-w-[900px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b">
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Serial Number</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Name</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Email</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Blood Group</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Location</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Approval</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDonors.map((donor) => (
                <tr key={donor.id} className="border-b">
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{donor.donorNumber ?? '-'}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{donor.fullName}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{donor.user.email}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{bloodGroupLabel[donor.bloodGroup] ?? donor.bloodGroup}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{donor.location}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${donor.eligibilityStatus ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {donor.eligibilityStatus ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex flex-wrap gap-2">
                      {donor.eligibilityStatus ? (
                        <button className="rounded bg-amber-100 px-3 py-1 text-amber-700" onClick={() => void setDonorApproval(donor.id, false)}>
                          Revoke
                        </button>
                      ) : (
                        <button className="rounded bg-green-100 px-3 py-1 text-green-700" onClick={() => void setDonorApproval(donor.id, true)}>
                          Approve
                        </button>
                      )}
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editDonor(donor)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteDonor(donor.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={donorsPage}
          hasMore={hasMoreDonors}
          onPrev={() => setDonorsPage((page) => Math.max(0, page - 1))}
          onNext={() => setDonorsPage((page) => page + 1)}
        />
        {null}
      </div>
      ) : null}

      {activeSection === 'hospitals' ? (
      <div id="hospitals" className="card space-y-3">
        <h2 className="text-xl font-semibold">Hospitals</h2>
        <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
          <table className={`min-w-[760px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b">
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Hospital</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Email</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Code</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Location</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHospitals.map((hospital) => (
                <tr key={hospital.id} className="border-b">
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.hospitalName}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.user.email}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.registrationCode}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.location}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editHospital(hospital)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteHospital(hospital.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={hospitalsPage}
          hasMore={hasMoreHospitals}
          onPrev={() => setHospitalsPage((page) => Math.max(0, page - 1))}
          onNext={() => setHospitalsPage((page) => page + 1)}
        />
        {null}
      </div>
      ) : null}

      {activeSection === 'request-tracking' ? (
      <div id="request-tracking" className="card space-y-3">
        <h2 className="text-xl font-semibold">Request Tracking</h2>
        {filteredRequests.length === 0 ? (
          <p className="text-sm text-muted">No blood request tracking records found.</p>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <article key={request.id} className="rounded border p-3">
                <p className="text-sm font-semibold">
                  {request.hospital?.hospitalName ?? 'Hospital'}: {request.bloodGroup} ({request.unitsNeeded} units)
                </p>
                <p className="text-xs text-gray-600">
                  Workflow {request.status} | Tracking {request.trackingStatus} | Need by{' '}
                  {new Date(request.requiredBy).toLocaleString()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['PENDING', 'MATCHED', 'IN_PROGRESS', 'CANCELLED'] as RequestProgressStatus[]).map((status) => (
                    <button
                      key={status}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                      onClick={() => void addTrackingUpdate(request.id, status)}
                      type="button"
                    >
                      Set {status}
                    </button>
                  ))}
                </div>
                {(() => {
                  const completionEvidence = request.updates?.find((update) => update.newStatus === 'COMPLETED');
                  return completionEvidence ? (
                    <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-900">
                      <p className="font-semibold">Completion Evidence (Hospital Entered)</p>
                      <p>transfusedByStaffId: {completionEvidence.transfusedByStaffId ?? '-'}</p>
                      <p>unitDin: {completionEvidence.unitDin ?? '-'}</p>
                      <p>patientEncounterId: {completionEvidence.patientEncounterId ?? '-'}</p>
                      <p>
                        enteredBy: {completionEvidence.updatedBy?.email ?? '-'} at{' '}
                        {new Date(completionEvidence.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      No completion evidence captured yet. Hospital must mark COMPLETED with required fields.
                    </p>
                  );
                })()}
                <div className="mt-3 rounded border p-3">
                  <p className="text-xs font-semibold text-primary">Admin Override / Correction (Audit Logged)</p>
                  <div className="mt-2 grid gap-2 lg:grid-cols-4">
                    <input
                      className="rounded border p-2 text-xs"
                      placeholder="transfusedByStaffId"
                      value={completionCorrection[request.id]?.transfusedByStaffId ?? ''}
                      onChange={(e) =>
                        setCompletionCorrection((prev) => ({
                          ...prev,
                          [request.id]: {
                            transfusedByStaffId: e.target.value,
                            unitDin: prev[request.id]?.unitDin ?? '',
                            patientEncounterId: prev[request.id]?.patientEncounterId ?? '',
                            overrideReason: prev[request.id]?.overrideReason ?? '',
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded border p-2 text-xs"
                      placeholder="unitDin"
                      value={completionCorrection[request.id]?.unitDin ?? ''}
                      onChange={(e) =>
                        setCompletionCorrection((prev) => ({
                          ...prev,
                          [request.id]: {
                            transfusedByStaffId: prev[request.id]?.transfusedByStaffId ?? '',
                            unitDin: e.target.value,
                            patientEncounterId: prev[request.id]?.patientEncounterId ?? '',
                            overrideReason: prev[request.id]?.overrideReason ?? '',
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded border p-2 text-xs"
                      placeholder="patientEncounterId"
                      value={completionCorrection[request.id]?.patientEncounterId ?? ''}
                      onChange={(e) =>
                        setCompletionCorrection((prev) => ({
                          ...prev,
                          [request.id]: {
                            transfusedByStaffId: prev[request.id]?.transfusedByStaffId ?? '',
                            unitDin: prev[request.id]?.unitDin ?? '',
                            patientEncounterId: e.target.value,
                            overrideReason: prev[request.id]?.overrideReason ?? '',
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded border p-2 text-xs"
                      placeholder="overrideReason (required)"
                      value={completionCorrection[request.id]?.overrideReason ?? ''}
                      onChange={(e) =>
                        setCompletionCorrection((prev) => ({
                          ...prev,
                          [request.id]: {
                            transfusedByStaffId: prev[request.id]?.transfusedByStaffId ?? '',
                            unitDin: prev[request.id]?.unitDin ?? '',
                            patientEncounterId: prev[request.id]?.patientEncounterId ?? '',
                            overrideReason: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <button
                    className="mt-2 rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700"
                    type="button"
                    onClick={() => void applyCompletionCorrection(request.id)}
                  >
                    Apply Admin Correction
                  </button>
                </div>
                {request.donorResponses?.length ? (
                  <div className="mt-3 space-y-2">
                    {request.donorResponses.map((response) => (
                      <div key={response.id} className="flex flex-wrap items-center gap-2 rounded border border-gray-100 p-2">
                        <span className="text-xs">{response.donor.fullName}</span>
                        <span className="text-xs text-gray-500">{response.responseStatus}</span>
                        <select
                          className="rounded border p-1 text-xs"
                          value={response.responseStatus}
                          onChange={(e) =>
                            void patchDonorResponse(response.id, e.target.value as DonorResponseStatus)
                          }
                        >
                          {(['PENDING', 'ACCEPTED', 'DECLINED', 'DONATED'] as DonorResponseStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
        <Pager
          page={requestsPage}
          hasMore={hasMoreRequests}
          onPrev={() => setRequestsPage((page) => Math.max(0, page - 1))}
          onNext={() => setRequestsPage((page) => page + 1)}
        />
      </div>
      ) : null}

      {activeSection === 'inventory-tracking' ? (
      <div id="inventory-tracking" className="card space-y-3">
        <h2 className="text-xl font-semibold">Inventory Log Tracking</h2>
        {filteredInventoryLogs.length === 0 ? (
          <p className="text-sm text-muted">No inventory log entries found.</p>
        ) : (
          <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
            <table className={`min-w-[740px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b">
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Hospital</th>
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Blood Group</th>
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Type</th>
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Units</th>
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>By</th>
                  <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>At</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventoryLogs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{log.inventory.hospital?.hospitalName ?? '-'}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{log.inventory.bloodGroup}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{log.changeType}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                      {log.previousUnits} to {log.newUnits} ({log.unitsChanged >= 0 ? '+' : ''}
                      {log.unitsChanged})
                    </td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{log.changedBy?.email ?? 'system'}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={inventoryLogsPage}
          hasMore={hasMoreInventoryLogs}
          onPrev={() => setInventoryLogsPage((page) => Math.max(0, page - 1))}
          onNext={() => setInventoryLogsPage((page) => page + 1)}
        />
      </div>
      ) : null}

      {activeSection === 'audit' ? (
      <div id="audit" className="card space-y-2">
        <h2 className="text-xl font-semibold">Audit Logs</h2>
        <p className="text-sm text-muted">
          Audit records are tracked in backend and available for extension in a dedicated admin audit table view.
        </p>
      </div>
      ) : null}

      <EditModal
        open={Boolean(editingUser)}
        title="Edit User"
        description="Update role and account status."
        onClose={() => setEditingUser(null)}
      >
        {editingUser ? (
          <form className="grid gap-3" onSubmit={(event) => void handleUserModalSubmit(event)}>
            <select className="rounded border p-2" value={editingUser.role} onChange={(e) => setEditingUser((v) => (v ? { ...v, role: e.target.value as Role } : v))}>
              {adminAssignableRoles.map((role) => (
                <option key={role} value={role}>{formatRole(role)}</option>
              ))}
            </select>
            <select className="rounded border p-2" value={String(editingUser.isActive)} onChange={(e) => setEditingUser((v) => (v ? { ...v, isActive: e.target.value === 'true' } : v))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingModal} type="submit">{savingModal ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : null}
      </EditModal>

      <EditModal open={Boolean(editingDonor)} title="Edit Donor" description="Update donor details." onClose={() => setEditingDonor(null)}>
        {editingDonor ? (
          <form className="grid gap-3" onSubmit={(event) => void handleDonorModalSubmit(event)}>
            <input className="rounded border bg-gray-100 p-2" value={editingDonor.donorNumber} readOnly />
            <input className="rounded border p-2" value={editingDonor.fullName} onChange={(e) => setEditingDonor((v) => (v ? { ...v, fullName: e.target.value } : v))} required />
            <input className="rounded border p-2" value={editingDonor.location} onChange={(e) => setEditingDonor((v) => (v ? { ...v, location: e.target.value } : v))} required />
            <select className="rounded border p-2" value={editingDonor.bloodGroup} onChange={(e) => setEditingDonor((v) => (v ? { ...v, bloodGroup: e.target.value } : v))}>
              {bloodGroups.map((group) => <option key={group} value={group}>{bloodGroupLabel[group] ?? group}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingDonor(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingModal} type="submit">{savingModal ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : null}
      </EditModal>

      <EditModal open={Boolean(editingHospital)} title="Edit Hospital" description="Update hospital details." onClose={() => setEditingHospital(null)}>
        {editingHospital ? (
          <form className="grid gap-3" onSubmit={(event) => void handleHospitalModalSubmit(event)}>
            <input className="rounded border p-2" value={editingHospital.hospitalName} onChange={(e) => setEditingHospital((v) => (v ? { ...v, hospitalName: e.target.value } : v))} required />
            <input className="rounded border p-2" value={editingHospital.location} onChange={(e) => setEditingHospital((v) => (v ? { ...v, location: e.target.value } : v))} required />
            <input className="rounded border p-2" value={editingHospital.contactName} onChange={(e) => setEditingHospital((v) => (v ? { ...v, contactName: e.target.value } : v))} required />
            <div className="flex gap-2 justify-end">
              <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingHospital(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingModal} type="submit">{savingModal ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : null}
      </EditModal>
    </section>
  );
}


