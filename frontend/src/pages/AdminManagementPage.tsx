import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

type UserItem = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
};

type DonorItem = {
  id: string;
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

export default function AdminManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [donors, setDonors] = useState<DonorItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [accountRole, setAccountRole] = useState<Role>('DONOR');
  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
    fullName: '',
    bloodGroup: 'O_POS',
    location: '',
    eligibilityStatus: true,
    availabilityStatus: true,
    emergencyContactName: '',
    emergencyContactPhone: '',
    hospitalName: '',
    registrationCode: '',
    address: '',
    contactName: '',
    contactPhone: '',
  });

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, donorsRes, hospitalsRes] = await Promise.all([
        api.get('/users'),
        api.get('/donors/admin'),
        api.get('/hospitals/admin'),
      ]);

      setUsers(usersRes.data.data);
      setDonors(donorsRes.data.data);
      setHospitals(hospitalsRes.data.data);
    } catch {
      setError('Failed to load admin data. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
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
      bloodGroup: 'O_POS',
      location: '',
      eligibilityStatus: true,
      availabilityStatus: true,
      emergencyContactName: '',
      emergencyContactPhone: '',
      hospitalName: '',
      registrationCode: '',
      address: '',
      contactName: '',
      contactPhone: '',
    });
  };

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

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
          emergencyContactPhone: accountForm.emergencyContactPhone,
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
          contactPhone: accountForm.contactPhone,
        });
      }

      resetAccountForm();
      await loadAll();
    } catch {
      setError('Could not create account. Check required fields for selected account type.');
    }
  };

  const editUser = async (user: UserItem) => {
    const role = prompt('Update role (ADMIN, DONOR, HOSPITAL_STAFF):', user.role);
    const isActive = prompt('Set active status (true/false):', String(user.isActive));
    if (!role || !isActive) {
      return;
    }

    try {
      await api.patch(`/users/${user.id}`, {
        role,
        isActive: isActive.toLowerCase() === 'true',
      });
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

  const editDonor = async (donor: DonorItem) => {
    const fullName = prompt('Full name:', donor.fullName);
    const location = prompt('Location:', donor.location);
    const bloodGroup = prompt('Blood group (example O_POS):', donor.bloodGroup);

    if (!fullName || !location || !bloodGroup) {
      return;
    }

    try {
      await api.patch(`/donors/admin/${donor.id}`, { fullName, location, bloodGroup });
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

  const editHospital = async (hospital: HospitalItem) => {
    const hospitalName = prompt('Hospital name:', hospital.hospitalName);
    const location = prompt('Location:', hospital.location);
    const contactName = prompt('Contact name:', hospital.contactName);

    if (!hospitalName || !location || !contactName) {
      return;
    }

    try {
      await api.patch(`/hospitals/admin/${hospital.id}`, { hospitalName, location, contactName });
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

      <form className="card space-y-3" onSubmit={createAccount}>
        <h2 className="text-xl font-semibold">Add Account</h2>
        <p className="text-sm text-muted">Allowed account types: Donor, Hospital Staff, Admin.</p>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold">
            Account Type
            <select
              className="mt-1 w-full rounded border p-2"
              value={accountRole}
              onChange={(e) => setAccountRole(e.target.value as Role)}
            >
              <option value="DONOR">Donor</option>
              <option value="HOSPITAL_STAFF">Hospital Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          <label className="text-sm font-semibold">
            Email
            <input
              className="mt-1 w-full rounded border p-2"
              placeholder="email@example.com"
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
              value={accountForm.password}
              onChange={(e) => setAccountForm((v) => ({ ...v, password: e.target.value }))}
              required
            />
          </label>
        </div>

        {accountRole === 'DONOR' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Full Name" value={accountForm.fullName} onChange={(e) => setAccountForm((v) => ({ ...v, fullName: e.target.value }))} required />
            <select className="rounded border p-2" value={accountForm.bloodGroup} onChange={(e) => setAccountForm((v) => ({ ...v, bloodGroup: e.target.value }))}>
              {bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Emergency Contact Name" value={accountForm.emergencyContactName} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactName: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Emergency Contact Phone" value={accountForm.emergencyContactPhone} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactPhone: e.target.value }))} required />
          </div>
        ) : null}

        {accountRole === 'HOSPITAL_STAFF' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Hospital Name" value={accountForm.hospitalName} onChange={(e) => setAccountForm((v) => ({ ...v, hospitalName: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Registration Code" value={accountForm.registrationCode} onChange={(e) => setAccountForm((v) => ({ ...v, registrationCode: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Address" value={accountForm.address} onChange={(e) => setAccountForm((v) => ({ ...v, address: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Contact Name" value={accountForm.contactName} onChange={(e) => setAccountForm((v) => ({ ...v, contactName: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Contact Phone" value={accountForm.contactPhone} onChange={(e) => setAccountForm((v) => ({ ...v, contactPhone: e.target.value }))} required />
          </div>
        ) : null}

        <button className="btn-primary" type="submit">Create Account</button>
      </form>

      <div className="card space-y-3">
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
                  <td className="py-2">{user.role}</td>
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
      </div>

      <div className="card space-y-3">
        <h2 className="text-xl font-semibold">Donors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Blood Group</th>
                <th className="py-2">Location</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <tr key={donor.id} className="border-b">
                  <td className="py-2">{donor.fullName}</td>
                  <td className="py-2">{donor.user.email}</td>
                  <td className="py-2">{donor.bloodGroup}</td>
                  <td className="py-2">{donor.location}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editDonor(donor)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteDonor(donor.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-3">
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
      </div>
    </section>
  );
}
