import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { countryCodes } from '../constants/country-codes';
import {
  BloodRequestItem,
  DonorResponseStatus,
  InventoryLogItem,
  RequestProgressStatus,
  createBloodRequestUpdate,
  getAllBloodRequests,
  getInventoryLogs,
  updateDonorResponse,
} from '../services/hospital-portal';

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

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
const formatRole = (role: Role) => (role === 'HOSPITAL_STAFF' ? 'HOSPITAL' : role);
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

export default function AdminManagementPage() {
  const location = useLocation();
  const activeSection = location.hash?.replace('#', '') || 'settings';
  const [users, setUsers] = useState<UserItem[]>([]);
  const [donors, setDonors] = useState<DonorItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestTracking, setRequestTracking] = useState<BloodRequestItem[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([]);

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
  const [editingDonor, setEditingDonor] = useState<{ id: string; fullName: string; location: string; bloodGroup: string } | null>(null);
  const [editingHospital, setEditingHospital] = useState<{
    id: string;
    hospitalName: string;
    location: string;
    contactName: string;
  } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, donorsRes, hospitalsRes, requestsData, inventoryLogData] = await Promise.all([
        api.get('/users'),
        api.get('/donors/admin'),
        api.get('/hospitals/admin'),
        getAllBloodRequests(),
        getInventoryLogs(),
      ]);

      setUsers(usersRes.data.data);
      setDonors(donorsRes.data.data);
      setHospitals(hospitalsRes.data.data);
      setRequestTracking(requestsData);
      setInventoryLogs(inventoryLogData);
    } catch {
      setError('Failed to load admin data. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  const addTrackingUpdate = async (requestId: string, newStatus: RequestProgressStatus) => {
    try {
      await createBloodRequestUpdate(requestId, { newStatus });
      await loadAll();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not add tracking update.');
    }
  };

  const patchDonorResponse = async (responseId: string, responseStatus: DonorResponseStatus) => {
    try {
      await updateDonorResponse(responseId, { responseStatus });
      await loadAll();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update donor response.');
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

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
    if (accountRole === 'HOSPITAL_STAFF' && !nameRule.test(accountForm.contactName)) {
      setError('Contact name must contain letters only.');
      return;
    }

    try {
      if (accountRole === 'ADMIN') {
        await api.post('/users', {
          email: accountForm.email,
          password: accountForm.password,
          role: 'ADMIN',
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

      if (accountRole === 'HOSPITAL_STAFF') {
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
      await loadAll();
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
      await loadAll();
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
      await loadAll();
    } catch {
      setError('Could not delete user.');
    }
  };

  const editDonor = (donor: DonorItem) => {
    setEditingDonor({
      id: donor.id,
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
      await loadAll();
    } catch {
      setError('Could not update donor.');
    }
  };

  const deleteDonor = async (id: string) => {
    if (!confirm('Delete this donor?')) {
      return;
    }

    try {
      await api.delete(`/donors/admin/${id}`);
      await loadAll();
    } catch {
      setError('Could not delete donor.');
    }
  };

  const setDonorApproval = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/donors/admin/${id}/eligibility`, { approved });
      await loadAll();
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
      await loadAll();
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
      await loadAll();
    } catch {
      setError('Could not delete hospital.');
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Admin Control Center</h1>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-muted">Loading data...</p>}

      {activeSection === 'settings' ? (
      <form className="card space-y-3" onSubmit={createAccount} autoComplete="off">
        <h2 className="text-xl font-semibold">Add Account</h2>
        <p className="text-sm text-muted">Allowed account types: Donor, Hospital, Admin.</p>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold">
            Account Type
            <select
              className="mt-1 w-full rounded border p-2"
              value={accountRole}
              onChange={(e) => setAccountRole(e.target.value as Role)}
            >
              <option value="DONOR">Donor</option>
              <option value="HOSPITAL_STAFF">Hospital</option>
              <option value="ADMIN">Admin</option>
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

        {accountRole === 'HOSPITAL_STAFF' ? (
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Active</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">{formatRole(user.role)}</td>
                  <td className="py-2">{String(user.isActive)}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editUser(user)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteUser(user.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editingUser ? (
          <form className="rounded border bg-gray-50 p-3" onSubmit={updateUser}>
            <h3 className="mb-2 font-semibold">Edit User</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <select
                className="rounded border p-2"
                value={editingUser.role}
                onChange={(e) => setEditingUser((v) => (v ? { ...v, role: e.target.value as Role } : v))}
              >
                <option value="DONOR">DONOR</option>
                <option value="HOSPITAL_STAFF">HOSPITAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <select
                className="rounded border p-2"
                value={String(editingUser.isActive)}
                onChange={(e) =>
                  setEditingUser((v) => (v ? { ...v, isActive: e.target.value === 'true' } : v))
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <div className="flex gap-2">
                <button className="btn-primary" type="submit">
                  Update
                </button>
                <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
      ) : null}

      {activeSection === 'donors' ? (
      <div id="donors" className="card space-y-3">
        <h2 className="text-xl font-semibold">Donors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Serial Number</th>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Blood Group</th>
                <th className="py-2">Location</th>
                <th className="py-2">Approval</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <tr key={donor.id} className="border-b">
                  <td className="py-2">{donor.donorNumber ?? '-'}</td>
                  <td className="py-2">{donor.fullName}</td>
                  <td className="py-2">{donor.user.email}</td>
                  <td className="py-2">{bloodGroupLabel[donor.bloodGroup] ?? donor.bloodGroup}</td>
                  <td className="py-2">{donor.location}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${donor.eligibilityStatus ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {donor.eligibilityStatus ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
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
        {editingDonor ? (
          <form className="rounded border bg-gray-50 p-3" onSubmit={updateDonor}>
            <h3 className="mb-2 font-semibold">Edit Donor</h3>
            <div className="grid gap-2 md:grid-cols-4">
              <input
                className="rounded border p-2"
                placeholder="Full Name"
                value={editingDonor.fullName}
                onChange={(e) => setEditingDonor((v) => (v ? { ...v, fullName: e.target.value } : v))}
                required
              />
              <input
                className="rounded border p-2"
                placeholder="Location"
                value={editingDonor.location}
                onChange={(e) => setEditingDonor((v) => (v ? { ...v, location: e.target.value } : v))}
                required
              />
              <select
                className="rounded border p-2"
                value={editingDonor.bloodGroup}
                onChange={(e) => setEditingDonor((v) => (v ? { ...v, bloodGroup: e.target.value } : v))}
              >
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>
                    {bloodGroupLabel[group] ?? group}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="btn-primary" type="submit">
                  Update
                </button>
                <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingDonor(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
      ) : null}

      {activeSection === 'hospitals' ? (
      <div id="hospitals" className="card space-y-3">
        <h2 className="text-xl font-semibold">Hospitals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Hospital</th>
                <th className="py-2">Email</th>
                <th className="py-2">Code</th>
                <th className="py-2">Location</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((hospital) => (
                <tr key={hospital.id} className="border-b">
                  <td className="py-2">{hospital.hospitalName}</td>
                  <td className="py-2">{hospital.user.email}</td>
                  <td className="py-2">{hospital.registrationCode}</td>
                  <td className="py-2">{hospital.location}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editHospital(hospital)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteHospital(hospital.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editingHospital ? (
          <form className="rounded border bg-gray-50 p-3" onSubmit={updateHospital}>
            <h3 className="mb-2 font-semibold">Edit Hospital</h3>
            <div className="grid gap-2 md:grid-cols-4">
              <input
                className="rounded border p-2"
                placeholder="Hospital Name"
                value={editingHospital.hospitalName}
                onChange={(e) => setEditingHospital((v) => (v ? { ...v, hospitalName: e.target.value } : v))}
                required
              />
              <input
                className="rounded border p-2"
                placeholder="Location"
                value={editingHospital.location}
                onChange={(e) => setEditingHospital((v) => (v ? { ...v, location: e.target.value } : v))}
                required
              />
              <input
                className="rounded border p-2"
                placeholder="Contact Name"
                value={editingHospital.contactName}
                onChange={(e) => setEditingHospital((v) => (v ? { ...v, contactName: e.target.value } : v))}
                required
              />
              <div className="flex gap-2">
                <button className="btn-primary" type="submit">
                  Update
                </button>
                <button
                  className="rounded border px-3 py-2"
                  type="button"
                  onClick={() => setEditingHospital(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
      ) : null}

      {activeSection === 'request-tracking' ? (
      <div id="request-tracking" className="card space-y-3">
        <h2 className="text-xl font-semibold">Request Tracking</h2>
        {requestTracking.length === 0 ? (
          <p className="text-sm text-muted">No blood request tracking records found.</p>
        ) : (
          <div className="space-y-3">
            {requestTracking.slice(0, 12).map((request) => (
              <article key={request.id} className="rounded border p-3">
                <p className="text-sm font-semibold">
                  {request.hospital?.hospitalName ?? 'Hospital'}: {request.bloodGroup} ({request.unitsNeeded} units)
                </p>
                <p className="text-xs text-gray-600">
                  Workflow {request.status} | Tracking {request.trackingStatus} | Need by{' '}
                  {new Date(request.requiredBy).toLocaleString()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as RequestProgressStatus[]).map((status) => (
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
      </div>
      ) : null}

      {activeSection === 'inventory-tracking' ? (
      <div id="inventory-tracking" className="card space-y-3">
        <h2 className="text-xl font-semibold">Inventory Log Tracking</h2>
        {inventoryLogs.length === 0 ? (
          <p className="text-sm text-muted">No inventory log entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Hospital</th>
                  <th className="py-2">Blood Group</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Units</th>
                  <th className="py-2">By</th>
                  <th className="py-2">At</th>
                </tr>
              </thead>
              <tbody>
                {inventoryLogs.slice(0, 30).map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2">{log.inventory.hospital?.hospitalName ?? '-'}</td>
                    <td className="py-2">{log.inventory.bloodGroup}</td>
                    <td className="py-2">{log.changeType}</td>
                    <td className="py-2">
                      {log.previousUnits} to {log.newUnits} ({log.unitsChanged >= 0 ? '+' : ''}
                      {log.unitsChanged})
                    </td>
                    <td className="py-2">{log.changedBy?.email ?? 'system'}</td>
                    <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    </section>
  );
}
