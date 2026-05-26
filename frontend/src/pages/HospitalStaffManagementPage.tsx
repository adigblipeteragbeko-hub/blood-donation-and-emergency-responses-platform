import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  approveDonorEligibilityByHospital,
  EligibilitySubmissionItem,
  getEligibilitySubmissions,
  submitOfficeUseForm,
} from '../services/hospital-portal';
import {
  createHospitalDepartment,
  createHospitalStaff,
  DepartmentType,
  getHospitalDepartments,
  getHospitalStaff,
  HospitalDepartmentItem,
  HospitalStaffItem,
  StaffAccountStatus,
  StaffRole,
  updateHospitalDepartment,
  updateHospitalStaff,
  updateHospitalStaffStatus,
} from '../services/hospital-staff';

const officeUseInitial = {
  appearance: '',
  medicalHistory: '',
  weightKg: '',
  bloodPressure: '',
  pulseBpm: '',
  hbByCuSo4: '',
  hbCheckedGdl: '',
  hbSagChecked: '',
  hbSagResult: '',
  screeningOutcome: '',
  permanentDeferralReason: '',
  temporaryDeferralReason: '',
  temporaryDeferralDuration: '',
  comments: '',
  nurseName: '',
  nurseSignature: '',
  donationNumber: '',
  packType: '',
  bleedStart: '',
  bleedEnd: '',
  phlebotomyOutcome: '',
  unsuccessfulReason: '',
  adverseEvents: '',
};

const staffRoleOptions: StaffRole[] = [
  'HOSPITAL_STAFF',
  'HOSPITAL_STAFF',
  'BLOOD_BANK_OFFICER',
  'BLOOD_BANK_OFFICER',
];

const staffStatusOptions: StaffAccountStatus[] = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE'];

const departmentTypes: DepartmentType[] = [
  'BLOOD_BANK',
  'EMERGENCY',
  'LABORATORY',
  'TRANSFUSION',
  'OUTPATIENT',
  'ADMINISTRATION',
  'OTHER',
];

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function statusBadgeClass(status: StaffAccountStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'ON_LEAVE':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'SUSPENDED':
      return 'bg-red-50 text-red-700 ring-red-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

export default function HospitalStaffManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'operations' | 'review'>('operations');
  const [departments, setDepartments] = useState<HospitalDepartmentItem[]>([]);
  const [staff, setStaff] = useState<HospitalStaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<StaffAccountStatus | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    type: 'BLOOD_BANK' as DepartmentType,
    description: '',
    isActive: true,
  });
  const [editingDepartmentId, setEditingDepartmentId] = useState('');

  const [staffForm, setStaffForm] = useState({
    email: '',
    password: '',
    role: 'HOSPITAL_STAFF' as StaffRole,
    fullName: '',
    title: '',
    departmentId: '',
    employeeCode: '',
    status: 'ACTIVE' as StaffAccountStatus,
    isDepartmentHead: false,
  });
  const [editingStaffId, setEditingStaffId] = useState('');

  const [submissions, setSubmissions] = useState<EligibilitySubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [activeDonorId, setActiveDonorId] = useState('');
  const [officeUse, setOfficeUse] = useState(officeUseInitial);

  const canManageStaff = user?.role === 'HOSPITAL_STAFF' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canReviewDonors =
    user?.role === 'HOSPITAL_STAFF' ||
    user?.role === 'BLOOD_BANK_OFFICER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  const loadStaffOperations = async () => {
    setLoading(true);
    setStaffLoading(true);
    setError('');
    try {
      const [departmentData, staffData] = await Promise.all([
        getHospitalDepartments(),
        getHospitalStaff({
          search: staffSearch || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          departmentId: departmentFilter || undefined,
          take: 100,
        }),
      ]);
      setDepartments(departmentData);
      setStaff(staffData);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not load hospital staff operations.');
    } finally {
      setLoading(false);
      setStaffLoading(false);
    }
  };

  const loadDonorReview = async () => {
    setSubmissionsLoading(true);
    setError('');
    try {
      const data = await getEligibilitySubmissions();
      setSubmissions(data);
      if (!activeDonorId && data.length > 0) {
        setActiveDonorId(data[0].donorId);
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not load donor review queue.');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'operations') {
      void loadStaffOperations();
    } else {
      void loadDonorReview();
    }
  }, [activeTab, staffSearch, roleFilter, statusFilter, departmentFilter]);

  const activeSubmission = useMemo(
    () => submissions.find((item) => item.donorId === activeDonorId) ?? null,
    [submissions, activeDonorId],
  );

  useEffect(() => {
    if (!activeSubmission) {
      setOfficeUse(officeUseInitial);
      return;
    }
    const existing = activeSubmission.officeUse?.officeUseOnly as Record<string, unknown> | undefined;
    setOfficeUse({
      ...officeUseInitial,
      appearance: String(existing?.appearance ?? ''),
      medicalHistory: String(existing?.medicalHistory ?? ''),
      weightKg: String(existing?.weightKg ?? ''),
      bloodPressure: String(existing?.bloodPressure ?? ''),
      pulseBpm: String(existing?.pulseBpm ?? ''),
      hbByCuSo4: String(existing?.hbByCuSo4 ?? ''),
      hbCheckedGdl: String(existing?.hbCheckedGdl ?? ''),
      hbSagChecked: String(existing?.hbSagChecked ?? ''),
      hbSagResult: String(existing?.hbSagResult ?? ''),
      screeningOutcome: String(existing?.screeningOutcome ?? ''),
      permanentDeferralReason: String(existing?.permanentDeferralReason ?? ''),
      temporaryDeferralReason: String(existing?.temporaryDeferralReason ?? ''),
      temporaryDeferralDuration: String(existing?.temporaryDeferralDuration ?? ''),
      comments: String(existing?.comments ?? ''),
      nurseName: String(existing?.nurseName ?? ''),
      nurseSignature: String(existing?.nurseSignature ?? ''),
      donationNumber: String(existing?.donationNumber ?? ''),
      packType: String(existing?.packType ?? ''),
      bleedStart: String(existing?.bleedStart ?? ''),
      bleedEnd: String(existing?.bleedEnd ?? ''),
      phlebotomyOutcome: String(existing?.phlebotomyOutcome ?? ''),
      unsuccessfulReason: String(existing?.unsuccessfulReason ?? ''),
      adverseEvents: String(existing?.adverseEvents ?? ''),
    });
  }, [activeSubmission]);

  const resetDepartmentForm = () => {
    setDepartmentForm({
      name: '',
      type: 'BLOOD_BANK',
      description: '',
      isActive: true,
    });
    setEditingDepartmentId('');
  };

  const resetStaffForm = () => {
    setStaffForm({
      email: '',
      password: '',
      role: 'HOSPITAL_STAFF',
      fullName: '',
      title: '',
      departmentId: '',
      employeeCode: '',
      status: 'ACTIVE',
      isDepartmentHead: false,
    });
    setEditingStaffId('');
  };

  const handleDepartmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingDepartmentId) {
        await updateHospitalDepartment(editingDepartmentId, {
          ...departmentForm,
          description: departmentForm.description || undefined,
        });
        setMessage('Department updated successfully.');
      } else {
        await createHospitalDepartment({
          ...departmentForm,
          description: departmentForm.description || undefined,
        });
        setMessage('Department created successfully.');
      }
      resetDepartmentForm();
      await loadStaffOperations();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not save department.');
    }
  };

  const handleStaffSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingStaffId) {
        await updateHospitalStaff(editingStaffId, {
          email: staffForm.email,
          role: staffForm.role,
          title: staffForm.title,
          departmentId: staffForm.departmentId || null,
          status: staffForm.status,
          isDepartmentHead: staffForm.isDepartmentHead,
        });
        setMessage('Staff account updated successfully.');
      } else {
        await createHospitalStaff({
          email: staffForm.email,
          password: staffForm.password,
          role: staffForm.role,
          fullName: staffForm.fullName,
          title: staffForm.title,
          departmentId: staffForm.departmentId || undefined,
          employeeCode: staffForm.employeeCode || undefined,
          status: staffForm.status,
          isDepartmentHead: staffForm.isDepartmentHead,
        });
        setMessage('Staff account created successfully.');
      }
      resetStaffForm();
      await loadStaffOperations();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not save staff member.');
    }
  };

  const handleStaffStatus = async (staffItem: HospitalStaffItem, status: StaffAccountStatus) => {
    setError('');
    setMessage('');
    try {
      await updateHospitalStaffStatus(staffItem.id, {
        status,
        isActive: status === 'ACTIVE' || status === 'ON_LEAVE',
      });
      setMessage(`Staff status updated to ${formatEnum(status)}.`);
      await loadStaffOperations();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update staff status.');
    }
  };

  const saveOfficeUse = async () => {
    if (!activeSubmission) {
      return;
    }
    setMessage('');
    setError('');
    try {
      await submitOfficeUseForm(activeSubmission.donorId, officeUse);
      setMessage('Clinical office-use section saved.');
      await loadDonorReview();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not save office-use form.');
    }
  };

  const submitDecision = async (approved: boolean) => {
    if (!activeSubmission) {
      return;
    }
    setMessage('');
    setError('');
    try {
      await approveDonorEligibilityByHospital(activeSubmission.donorId, approved);
      setMessage(approved ? 'Donor approved successfully.' : 'Donor rejected successfully.');
      await loadDonorReview();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not submit donor decision.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">Hospital Staff & Clinical Operations</h1>
            <p className="text-sm text-muted">
              Run staffing, departments, and donor clinical review from one hospital-grade operations console.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'operations' ? 'bg-primary text-white' : 'bg-red-50 text-primary'}`}
              onClick={() => setActiveTab('operations')}
            >
              Staff Operations
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'review' ? 'bg-primary text-white' : 'bg-red-50 text-primary'}`}
              onClick={() => setActiveTab('review')}
            >
              Donor Review Queue
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      {activeTab === 'operations' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <article className="card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Departments</p>
              <p className="mt-2 text-3xl font-bold text-primary">{departments.length}</p>
              <p className="mt-2 text-sm text-muted">Structured clinical and operational units for this hospital.</p>
            </article>
            <article className="card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Staff Accounts</p>
              <p className="mt-2 text-3xl font-bold text-primary">{staff.length}</p>
              <p className="mt-2 text-sm text-muted">Active staff hierarchy with role-based permissions.</p>
            </article>
            <article className="card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Department Heads</p>
              <p className="mt-2 text-3xl font-bold text-primary">{staff.filter((item) => item.isDepartmentHead).length}</p>
              <p className="mt-2 text-sm text-muted">Clinical leads and operations owners currently assigned.</p>
            </article>
            <article className="card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Review Officers</p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {staff.filter((item) => item.user.role === 'BLOOD_BANK_OFFICER').length}
              </p>
              <p className="mt-2 text-sm text-muted">Dedicated officers for screening and approval workflow.</p>
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-primary">Departments</h2>
                  <p className="text-sm text-muted">Organize operational and clinical teams with explicit ownership.</p>
                </div>
              </div>

              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleDepartmentSubmit}>
                <label className="text-sm font-semibold text-slate-700">
                  Department name
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={departmentForm.name}
                    onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Blood Bank Unit"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Department type
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={departmentForm.type}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({ ...current, type: event.target.value as DepartmentType }))
                    }
                  >
                    {departmentTypes.map((option) => (
                      <option key={option} value={option}>
                        {formatEnum(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    rows={3}
                    value={departmentForm.description}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Scope, coverage, and operational responsibilities."
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={departmentForm.isActive}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  Active department
                </label>
                <div className="flex gap-2">
                  <button className="btn-primary" type="submit" disabled={!canManageStaff}>
                    {editingDepartmentId ? 'Update Department' : 'Add Department'}
                  </button>
                  {editingDepartmentId ? (
                    <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" type="button" onClick={resetDepartmentForm}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted">Loading departments...</p> : null}
                {departments.length === 0 && !loading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-muted">
                    No departments yet. Start by creating the hospital units that will own staffing and workflow.
                  </div>
                ) : null}
                {departments.map((department) => (
                  <article key={department.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{department.name}</h3>
                        <p className="text-sm text-muted">{formatEnum(department.type)}</p>
                        <p className="mt-2 text-sm text-slate-600">{department.description || 'No description provided yet.'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${department.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                          {department.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <p className="mt-2 text-xs text-muted">{department._count?.staffMembers ?? 0} staff linked</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        onClick={() => {
                          setEditingDepartmentId(department.id);
                          setDepartmentForm({
                            name: department.name,
                            type: department.type,
                            description: department.description || '',
                            isActive: department.isActive,
                          });
                        }}
                        disabled={!canManageStaff}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        onClick={() =>
                          setDepartmentForm((current) => ({ ...current, isActive: !department.isActive }))
                        }
                        disabled
                        title="Department activation is managed through Edit."
                      >
                        Toggle via Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="card space-y-4">
              <div>
                <h2 className="text-lg font-bold text-primary">Staff Hierarchy</h2>
                <p className="text-sm text-muted">
                  Create and manage hospital operations accounts without giving them unnecessary platform access.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                  placeholder="Search by email, title, code"
                  value={staffSearch}
                  onChange={(event) => setStaffSearch(event.target.value)}
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as StaffRole | '')}
                >
                  <option value="">All roles</option>
                  {staffRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatEnum(option)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StaffAccountStatus | '')}
                >
                  <option value="">All statuses</option>
                  {staffStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatEnum(option)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <form className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2" onSubmit={handleStaffSubmit}>
                <label className="text-sm font-semibold text-slate-700">
                  Staff email
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.email}
                    onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="nurse@hospital.org"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Full name / identity label
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.fullName}
                    onChange={(event) => setStaffForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Ama Mensah"
                    required={!editingStaffId}
                  />
                </label>
                {!editingStaffId ? (
                  <label className="text-sm font-semibold text-slate-700">
                    Temporary password
                    <input
                      type="password"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                      value={staffForm.password}
                      onChange={(event) => setStaffForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Temporary password"
                      required
                    />
                  </label>
                ) : null}
                <label className="text-sm font-semibold text-slate-700">
                  Role
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.role}
                    onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
                  >
                    {staffRoleOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatEnum(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Title
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.title}
                    onChange={(event) => setStaffForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Senior Inventory Officer"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Department
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.departmentId}
                    onChange={(event) => setStaffForm((current) => ({ ...current, departmentId: event.target.value }))}
                  >
                    <option value="">No department assigned</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Employee code
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.employeeCode}
                    onChange={(event) => setStaffForm((current) => ({ ...current, employeeCode: event.target.value }))}
                    placeholder="Optional auto-generated if blank"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Staff status
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-sm"
                    value={staffForm.status}
                    onChange={(event) =>
                      setStaffForm((current) => ({ ...current, status: event.target.value as StaffAccountStatus }))
                    }
                  >
                    {staffStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatEnum(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={staffForm.isDepartmentHead}
                    onChange={(event) =>
                      setStaffForm((current) => ({ ...current, isDepartmentHead: event.target.checked }))
                    }
                  />
                  Department head
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button className="btn-primary" type="submit" disabled={!canManageStaff}>
                    {editingStaffId ? 'Update Staff' : 'Create Staff Account'}
                  </button>
                  {editingStaffId ? (
                    <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" type="button" onClick={resetStaffForm}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="space-y-3">
                {staffLoading ? <p className="text-sm text-muted">Loading staff hierarchy...</p> : null}
                {staff.length === 0 && !staffLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-muted">
                    No staff accounts match the current filters. Create a hospital operations role to get started.
                  </div>
                ) : null}
                {staff.map((staffItem) => (
                  <article key={staffItem.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{staffItem.user.email}</h3>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(staffItem.status)}`}>
                            {formatEnum(staffItem.status)}
                          </span>
                          {staffItem.isDepartmentHead ? (
                            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                              Department Head
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatEnum(staffItem.user.role)} · {staffItem.title}
                        </p>
                        <p className="text-sm text-muted">
                          {staffItem.department?.name ?? 'No department'} · Code {staffItem.employeeCode}
                        </p>
                        <p className="text-xs text-muted">
                          Account {staffItem.user.isActive ? 'active' : 'inactive'} · Created{' '}
                          {new Date(staffItem.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                          onClick={() => {
                            setEditingStaffId(staffItem.id);
                            setStaffForm({
                              email: staffItem.user.email,
                              password: '',
                              role: staffItem.user.role,
                              fullName: staffItem.user.email,
                              title: staffItem.title,
                              departmentId: staffItem.departmentId || '',
                              employeeCode: staffItem.employeeCode,
                              status: staffItem.status,
                              isDepartmentHead: staffItem.isDepartmentHead,
                            });
                          }}
                          disabled={!canManageStaff}
                        >
                          Edit
                        </button>
                        <select
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                          value={staffItem.status}
                          onChange={(event) =>
                            void handleStaffStatus(staffItem, event.target.value as StaffAccountStatus)
                          }
                          disabled={!canManageStaff}
                        >
                          {staffStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {formatEnum(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="card space-y-3">
            <div>
              <h2 className="text-lg font-bold text-primary">Donor Review Queue</h2>
              <p className="text-sm text-muted">Submitted, screened, and decision-ready clinical forms.</p>
            </div>
            {submissionsLoading ? <p className="text-sm text-muted">Loading submissions...</p> : null}
            {submissions.length === 0 && !submissionsLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-muted">
                No donor submissions are currently assigned to this hospital.
              </div>
            ) : null}
            {submissions.map((item) => (
              <button
                key={item.donorId}
                type="button"
                onClick={() => setActiveDonorId(item.donorId)}
                className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                  activeDonorId === item.donorId
                    ? 'border-primary bg-red-50 text-primary'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md'
                }`}
              >
                <p className="font-semibold">{item.donor?.fullName ?? 'Unknown donor'}</p>
                <p className="text-sm">{item.donor?.bloodGroup ?? '-'} · {item.donor?.location ?? '-'}</p>
                <p className="text-xs text-muted">Submitted {new Date(item.submittedAt).toLocaleString()}</p>
              </button>
            ))}
          </aside>

          <div className="space-y-4">
            <section className="card">
              <h2 className="text-lg font-bold text-primary">Clinical Intake Summary</h2>
              {!activeSubmission ? (
                <p className="mt-3 text-sm text-muted">Select a donor submission to begin review.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Donor</p>
                      <p className="mt-2 font-semibold text-slate-900">{activeSubmission.donor?.fullName ?? '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Blood Group</p>
                      <p className="mt-2 font-semibold text-slate-900">{activeSubmission.donor?.bloodGroup ?? '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Eligibility</p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {activeSubmission.donor?.eligibilityStatus ? 'Previously eligible' : 'Previously ineligible'}
                      </p>
                    </div>
                  </div>
                  <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
                    {JSON.stringify(activeSubmission.donorForm, null, 2)}
                  </pre>
                </div>
              )}
            </section>

            <section className="card space-y-4">
              <div>
                <h2 className="text-lg font-bold text-primary">Office Use Workflow</h2>
                <p className="text-sm text-muted">
                  Complete the operational screening notes before recording an approval decision.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(officeUse).map(([key, value]) =>
                  key === 'comments' || key === 'adverseEvents' ? (
                    <textarea
                      key={key}
                      className="legacy-input md:col-span-2"
                      rows={3}
                      placeholder={formatEnum(key)}
                      value={value}
                      onChange={(event) => setOfficeUse((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  ) : (
                    <input
                      key={key}
                      className="legacy-input"
                      placeholder={formatEnum(key)}
                      value={value}
                      onChange={(event) => setOfficeUse((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  ),
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="button" onClick={() => void saveOfficeUse()} disabled={!canReviewDonors || !activeSubmission}>
                  Save Office Use Form
                </button>
                <button
                  className="rounded-xl border border-emerald-300 px-4 py-2 font-semibold text-emerald-700"
                  type="button"
                  onClick={() => void submitDecision(true)}
                  disabled={!canReviewDonors || !activeSubmission}
                >
                  Approve Donor
                </button>
                <button
                  className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700"
                  type="button"
                  onClick={() => void submitDecision(false)}
                  disabled={!canReviewDonors || !activeSubmission}
                >
                  Reject Donor
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

