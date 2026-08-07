import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { FilterBox, Pager } from '../components/TableControls';
import { EditModal } from '../components/ui/EditModal';
import { HospitalLocationPicker } from '../components/ui/HospitalLocationPicker';
import { AsyncTypeahead, TypeaheadSuggestion } from '../components/ui/AsyncTypeahead';
import { SmartAvatar } from '../components/SmartAvatar';
import { AdminAuditLogTable } from '../components/admin/AdminAuditLogTable';
import { DonorCommunicationsSection } from '../components/admin/DonorCommunicationsSection';
import { AiIntelligencePanel } from '../components/AiIntelligencePanel';
import { BloodSosAssistant } from '../components/BloodSosAssistant';
import { countryCodes } from '../constants/country-codes';
import { useAuth } from '../hooks/useAuth';
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

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_ADMIN';

type UserItem = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  emailVerified?: boolean;
  verifiedAt?: string | null;
  verificationMethod?: string | null;
  verificationReason?: string | null;
  emailVerificationAttempts?: Array<{
    status: string;
    provider?: string | null;
    failureReason?: string | null;
    sentAt?: string | null;
    failedAt?: string | null;
    createdAt: string;
  }>;
};

type DonorItem = {
  id: string;
  donorNumber?: string;
  fullName: string;
  firstName?: string | null;
  otherNames?: string | null;
  surname?: string | null;
  phone?: string | null;
  alternativePhoneNumber?: string | null;
  bloodGroup: string;
  location: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  availabilityStatus: boolean;
  eligibilityStatus: boolean;
  phoneVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    emailVerified?: boolean;
    verifiedAt?: string | null;
    createdAt?: string;
  };
  clinicalRecords?: Array<{
    id: string;
    status: string;
    submittedAt?: string | null;
    hospitalReviewedAt?: string | null;
    officeCompletedAt?: string | null;
    finalDecisionAt?: string | null;
    selectedHospital?: { hospitalName?: string | null } | null;
    clinicalReview?: {
      reviewedAt?: string | null;
      outcomeOfScreening?: string | null;
      qualifiesToDonate?: string | null;
      temporaryDeferralDuration?: string | null;
    } | null;
  }>;
};

type EditingDonor = DonorItem & {
  donorNumber: string;
  firstName: string;
  otherNames: string;
  surname: string;
  phone: string;
  alternativePhoneNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
};

type HospitalItem = {
  id: string;
  hospitalName: string;
  registrationCode: string;
  location: string;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isApproved?: boolean;
  bloodBankAvailable?: boolean;
  contactName: string;
  contactPhone: string;
  logoUrl?: string | null;
  user: { id: string; email: string; role: Role; isActive: boolean };
};

const bloodGroups = ['UNKNOWN', 'O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];
const formatRole = (role: Role) =>
  role
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
const adminAssignableRoles: Role[] = ['ADMIN', 'DONOR', 'HOSPITAL_ADMIN'];
const bloodGroupLabel: Record<string, string> = {
  UNKNOWN: 'Unknown / Not Tested Yet',
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
const relationshipOptions = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Friend', 'Relative', 'Other'];
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const clinicalStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  HOSPITAL_REVIEW: 'Under Hospital Review',
  OFFICE_USE_COMPLETED: 'Office Use Completed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  TEMPORARILY_DEFERRED: 'Temporarily Deferred',
  PERMANENTLY_DEFERRED: 'Permanently Deferred',
};
const clinicalStatusClass: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  HOSPITAL_REVIEW: 'bg-indigo-100 text-indigo-700',
  OFFICE_USE_COMPLETED: 'bg-cyan-100 text-cyan-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  TEMPORARILY_DEFERRED: 'bg-amber-100 text-amber-700',
  PERMANENTLY_DEFERRED: 'bg-rose-100 text-rose-700',
};
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '-';
const getLatestClinicalRecord = (donor: Pick<DonorItem, 'clinicalRecords'>) => donor.clinicalRecords?.[0] ?? null;
const getClinicalStatus = (donor: Pick<DonorItem, 'clinicalRecords'>) => getLatestClinicalRecord(donor)?.status ?? 'NOT_STARTED';
const formatClinicalStatus = (status: string) => status === 'NOT_STARTED' ? 'Not Started' : clinicalStatusLabel[status] ?? status.replace(/_/g, ' ');
const getClinicalStatusClass = (status: string) => clinicalStatusClass[status] ?? 'bg-slate-100 text-slate-700';
const formatAccountStatus = (donor: DonorItem) => donor.user.isActive ? 'Approved' : 'Suspended';
const getAccountStatusClass = (donor: DonorItem) => donor.user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
const resolveHospitalMapStatus = (hospital: HospitalItem): 'Map Ready' | 'Coordinates Missing' | 'Pending Approval' => {
  if (!hospital.isApproved) return 'Pending Approval';
  const hasCoordinates = typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number';
  return hasCoordinates ? 'Map Ready' : 'Coordinates Missing';
};

const splitPhone = (value?: string | null) => {
  const match = `${value ?? ''}`.match(/^(\+\d{1,4})(\d+)$/);
  return { code: match?.[1] ?? '+233', number: match?.[2] ?? '' };
};

export default function AdminManagementPage() {
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const activeSection =
    new URLSearchParams(location.search).get('section') || location.hash?.replace('#', '') || 'settings';
  const [users, setUsers] = useState<UserItem[]>([]);
  const [donors, setDonors] = useState<DonorItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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
    firstName: '',
    otherNames: '',
    surname: '',
    primaryPhoneCode: '+233',
    primaryPhone: '',
    alternativePhoneCode: '+233',
    alternativePhone: '',
    bloodGroup: '',
    location: '',
    emergencyContactName: '',
    emergencyContactCode: '+233',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    hospitalName: '',
    registrationCode: '',
    address: '',
    contactName: '',
    city: '',
    region: '',
    latitude: '',
    longitude: '',
    contactCode: '+233',
    contactPhone: '',
  });
  const [editingUser, setEditingUser] = useState<{ id: string; role: Role; isActive: boolean } | null>(null);
  const [manualVerifyUser, setManualVerifyUser] = useState<UserItem | null>(null);
  const [manualVerifyForm, setManualVerifyForm] = useState({
    method: 'USER_CONFIRMED_IN_PERSON',
    reason: '',
    note: '',
  });
  const [editingDonor, setEditingDonor] = useState<EditingDonor | null>(null);
  const [editingHospital, setEditingHospital] = useState<{
    id: string;
    hospitalName: string;
    location: string;
    city: string;
    region: string;
    latitude: string;
    longitude: string;
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
  const [capturingAccountHospitalLocation, setCapturingAccountHospitalLocation] = useState(false);
  const [capturingEditHospitalLocation, setCapturingEditHospitalLocation] = useState(false);

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
      } else if (activeSection === 'donor-communications' || activeSection === 'ai-intelligence' || activeSection === 'assistant') {
        return;
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      const sectionLabel =
        activeSection === 'settings'
          ? 'users'
          : activeSection === 'donors'
            ? 'donors'
            : activeSection === 'hospitals'
              ? 'hospitals'
              : activeSection === 'request-tracking'
                ? 'request tracking'
                : activeSection === 'inventory-tracking'
                  ? 'inventory tracking'
                  : 'admin management data';
      setError(extracted ?? `Unable to load ${sectionLabel}. Please refresh or contact support.`);
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
      firstName: '',
      otherNames: '',
      surname: '',
      primaryPhoneCode: '+233',
      primaryPhone: '',
      alternativePhoneCode: '+233',
      alternativePhone: '',
      bloodGroup: '',
      location: '',
      emergencyContactName: '',
      emergencyContactCode: '+233',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      hospitalName: '',
      registrationCode: '',
      address: '',
      contactName: '',
      city: '',
      region: '',
      latitude: '',
      longitude: '',
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
    setSuccessMessage('');

    if (!passwordRule.test(accountForm.password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and special character.');
      return;
    }
    if (
      accountRole === 'DONOR' &&
      (!nameRule.test(accountForm.firstName) ||
        (accountForm.otherNames && !nameRule.test(accountForm.otherNames)) ||
        !nameRule.test(accountForm.surname) ||
        !nameRule.test(accountForm.emergencyContactName))
    ) {
      setError('Donor name fields must contain letters only.');
      return;
    }
    if (accountRole === 'DONOR' && (!accountForm.primaryPhone.trim() || !accountForm.emergencyContactPhone.trim() || !accountForm.emergencyContactRelationship)) {
      setError('Primary phone number, emergency contact phone number, and relationship are required for donor accounts.');
      return;
    }
    if (accountRole === 'HOSPITAL_ADMIN' && !nameRule.test(accountForm.contactName)) {
      setError('Contact name must contain letters only.');
      return;
    }
    if (accountRole === 'HOSPITAL_ADMIN' && (!accountForm.city.trim() || !accountForm.region.trim())) {
      setError('City and region are required for emergency requests and live map coordination.');
      return;
    }
    const latitude = accountForm.latitude.trim() ? Number(accountForm.latitude) : undefined;
    const longitude = accountForm.longitude.trim() ? Number(accountForm.longitude) : undefined;
    if (accountRole === 'HOSPITAL_ADMIN' && (latitude === undefined || longitude === undefined)) {
      setError('Please select the hospital location on the map.');
      return;
    }
    if (accountRole === 'HOSPITAL_ADMIN' && latitude !== undefined && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (accountRole === 'HOSPITAL_ADMIN' && longitude !== undefined && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    try {
      if (accountRole === 'ADMIN') {
        await api.post('/users', {
          email: accountForm.email,
          password: accountForm.password,
          role: accountRole,
          isActive: true,
        });
      }

      if (accountRole === 'DONOR') {
        const fullName = [accountForm.surname, accountForm.firstName, accountForm.otherNames].filter(Boolean).join(' ');
        await api.post('/donors/admin', {
          email: accountForm.email,
          password: accountForm.password,
          fullName,
          firstName: accountForm.firstName,
          otherNames: accountForm.otherNames || undefined,
          surname: accountForm.surname,
          phone: `${accountForm.primaryPhoneCode}${accountForm.primaryPhone}`,
          alternativePhoneNumber: accountForm.alternativePhone ? `${accountForm.alternativePhoneCode}${accountForm.alternativePhone}` : undefined,
          bloodGroup: accountForm.bloodGroup,
          location: accountForm.location,
          emergencyContactName: accountForm.emergencyContactName,
          emergencyContactPhone: `${accountForm.emergencyContactCode}${accountForm.emergencyContactPhone}`,
          emergencyContactRelationship: accountForm.emergencyContactRelationship,
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
          city: accountForm.city || undefined,
          region: accountForm.region || undefined,
          latitude,
          longitude,
          contactName: accountForm.contactName,
          contactPhone: `${accountForm.contactCode}${accountForm.contactPhone}`,
        });
      }

      resetAccountForm();
      setSuccessMessage(
        accountRole === 'DONOR'
          ? 'Donor created successfully.'
          : accountRole === 'HOSPITAL_ADMIN'
            ? 'Hospital created successfully.'
            : 'User created successfully.',
      );
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
      setSuccessMessage('User updated successfully.');
      await refreshCurrentSection();
    } catch {
      setError('Could not update user.');
    }
  };

  const resendUserVerification = async (user: UserItem) => {
    try {
      setError('');
      await api.post(`/users/${user.id}/resend-verification`);
      setSuccessMessage(`Verification email queued for ${user.email}.`);
      await loadUsers();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setSuccessMessage('');
      setError(extracted ?? 'Could not resend verification email.');
    }
  };

  const submitManualVerification = async (event: FormEvent) => {
    event.preventDefault();
    if (!manualVerifyUser) return;

    try {
      setSavingModal(true);
      setError('');
      await api.post(`/users/${manualVerifyUser.id}/manual-verify`, manualVerifyForm);
      setSuccessMessage(`${manualVerifyUser.email} has been manually verified.`);
      setManualVerifyUser(null);
      setManualVerifyForm({ method: 'USER_CONFIRMED_IN_PERSON', reason: '', note: '' });
      await loadUsers();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setSuccessMessage('');
      setError(extracted ?? 'Could not manually verify this account.');
    } finally {
      setSavingModal(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      setError('You cannot delete the currently logged-in admin account.');
      setSuccessMessage('');
      return;
    }

    if (!confirm('Delete this user?')) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      setError('');
      setSuccessMessage('User deleted successfully.');
      await refreshCurrentSection();
    } catch (err: any) {
      const status = err?.response?.status;
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setSuccessMessage('');

      if (status === 401 || status === 403) {
        setError(extracted ?? 'Unauthorized.');
      } else if (status === 400) {
        setError(extracted ?? 'Unable to delete user because related records exist.');
      } else if (status >= 500) {
        setError(extracted ?? 'Server error while deleting user.');
      } else {
        setError(extracted ?? 'Could not delete user.');
      }
    }
  };

  const editDonor = (donor: DonorItem) => {
    const primaryPhone = splitPhone(donor.phone);
    const alternativePhone = splitPhone(donor.alternativePhoneNumber);
    const emergencyPhone = splitPhone(donor.emergencyContactPhone);
    const legacyNameParts = donor.fullName.trim().split(/\s+/).filter(Boolean);
    setEditingDonor({
      ...donor,
      id: donor.id,
      donorNumber: donor.donorNumber ?? '',
      fullName: donor.fullName,
      firstName: donor.firstName ?? legacyNameParts[1] ?? legacyNameParts[0] ?? '',
      otherNames: donor.otherNames ?? legacyNameParts.slice(2).join(' '),
      surname: donor.surname ?? (legacyNameParts.length > 1 ? legacyNameParts[0] : ''),
      phone: `${primaryPhone.code}${primaryPhone.number}`,
      alternativePhoneNumber: alternativePhone.number ? `${alternativePhone.code}${alternativePhone.number}` : '',
      location: donor.location,
      bloodGroup: donor.bloodGroup,
      emergencyContactName: donor.emergencyContactName ?? '',
      emergencyContactPhone: emergencyPhone.number ? `${emergencyPhone.code}${emergencyPhone.number}` : '',
      emergencyContactRelationship: donor.emergencyContactRelationship ?? '',
    });
  };

  const updateDonor = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDonor) {
      return;
    }
    try {
      const fullName = [editingDonor.surname, editingDonor.firstName, editingDonor.otherNames].filter(Boolean).join(' ') || editingDonor.fullName;
      await api.patch(`/donors/admin/${editingDonor.id}`, {
        fullName,
        firstName: editingDonor.firstName,
        otherNames: editingDonor.otherNames || undefined,
        surname: editingDonor.surname,
        phone: editingDonor.phone || undefined,
        alternativePhoneNumber: editingDonor.alternativePhoneNumber || undefined,
        location: editingDonor.location,
        bloodGroup: editingDonor.bloodGroup,
        emergencyContactName: editingDonor.emergencyContactName || undefined,
        emergencyContactPhone: editingDonor.emergencyContactPhone || undefined,
        emergencyContactRelationship: editingDonor.emergencyContactRelationship || undefined,
      });
      setEditingDonor(null);
      setSuccessMessage('Donor updated successfully.');
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Unable to update donor. Please check required fields.');
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

  const setDonorAccountStatus = async (id: string, approved: boolean) => {
    const confirmMessage = approved
      ? [
          'Approve Donor Account',
          '',
          'This action approves the donor account to use the BloodSOS platform.',
          '',
          'This does NOT approve the donor for blood donation.',
          '',
          "Clinical eligibility can only be approved by an authorised Hospital Administrator after reviewing the donor's Health & Eligibility Form.",
        ].join('\n')
      : [
          'Suspend Donor Account',
          '',
          'The donor will lose access to the platform.',
          '',
          'Existing clinical records will not be deleted.',
        ].join('\n');
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await api.patch(`/donors/admin/${id}/account-status`, { active: approved });
      setSuccessMessage(approved ? 'Donor account approved successfully.' : 'Donor account suspended successfully.');
      await refreshCurrentSection();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update donor account status.');
    }
  };

  const editHospital = (hospital: HospitalItem) => {
    setEditingHospital({
      id: hospital.id,
      hospitalName: hospital.hospitalName,
      location: hospital.location,
      city: hospital.city ?? '',
      region: hospital.region ?? '',
      latitude: typeof hospital.latitude === 'number' ? String(hospital.latitude) : '',
      longitude: typeof hospital.longitude === 'number' ? String(hospital.longitude) : '',
      contactName: hospital.contactName,
    });
  };

  const updateHospital = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingHospital) {
      return;
    }
    const latitude = editingHospital.latitude.trim() ? Number(editingHospital.latitude) : undefined;
    const longitude = editingHospital.longitude.trim() ? Number(editingHospital.longitude) : undefined;
    if (!editingHospital.city.trim() || !editingHospital.region.trim()) {
      setError('City and region are required for emergency requests and live map coordination.');
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      setError('Please select the hospital location on the map.');
      return;
    }
    if (latitude !== undefined && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (longitude !== undefined && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    try {
      await api.patch(`/hospitals/admin/${editingHospital.id}`, {
        hospitalName: editingHospital.hospitalName,
        location: editingHospital.location,
        city: editingHospital.city || undefined,
        region: editingHospital.region || undefined,
        latitude,
        longitude,
        contactName: editingHospital.contactName,
      });
      setEditingHospital(null);
      setSuccessMessage('Hospital updated successfully.');
      await refreshCurrentSection();
    } catch {
      setError('Could not update hospital.');
    }
  };

  const useBrowserLocationForAccountHospital = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Browser geolocation is not available. Please pick the hospital location on the map.');
      return;
    }
    setCapturingAccountHospitalLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAccountForm((v) => ({
          ...v,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setSuccessMessage('Browser location captured. Confirm the pin is on the hospital before saving.');
        setCapturingAccountHospitalLocation(false);
      },
      () => {
        setError('Could not capture browser location. Please pick the hospital location on the map.');
        setCapturingAccountHospitalLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
    );
  };

  const useBrowserLocationForEditingHospital = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Browser geolocation is not available. Please pick the hospital location on the map.');
      return;
    }
    setCapturingEditHospitalLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEditingHospital((v) =>
          v ? { ...v, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) } : v,
        );
        setSuccessMessage('Browser location captured. Confirm the pin is on the hospital before saving.');
        setCapturingEditHospitalLocation(false);
      },
      () => {
        setError('Could not capture browser location. Please pick the hospital location on the map.');
        setCapturingEditHospitalLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
    );
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
      includesTerm(donor.bloodGroup) ||
      includesTerm(formatAccountStatus(donor)) ||
      includesTerm(formatClinicalStatus(getClinicalStatus(donor))) ||
      includesTerm(donor.availabilityStatus ? 'Available' : 'Unavailable'),
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
      includesTerm(request.requestSource) ||
      includesTerm(String(request.unitsNeeded)),
  );
  const filteredInventoryLogs = inventoryLogs.filter(
    (log) =>
      includesTerm(log.inventory.hospital?.hospitalName) ||
      includesTerm(log.inventory.bloodGroup) ||
      includesTerm(log.changeType) ||
      includesTerm(log.changedBy?.email),
  );
  const editingClinicalRecord = editingDonor ? getLatestClinicalRecord(editingDonor) : null;
  const editingClinicalStatus = editingDonor ? getClinicalStatus(editingDonor) : 'NOT_STARTED';

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
      {successMessage && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{successMessage}</p>}
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
        <p className="text-sm text-muted">Create donor, hospital-admin, and administrative accounts.</p>

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
            <input className="rounded border p-2" placeholder="First Name *" value={accountForm.firstName} onChange={(e) => setAccountForm((v) => ({ ...v, firstName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="First name should contain letters only" required />
            <input className="rounded border p-2" placeholder="Other Name(s)" value={accountForm.otherNames} onChange={(e) => setAccountForm((v) => ({ ...v, otherNames: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Other names should contain letters only" />
            <input className="rounded border p-2" placeholder="Surname *" value={accountForm.surname} onChange={(e) => setAccountForm((v) => ({ ...v, surname: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Surname should contain letters only" required />
            <select className="rounded border p-2" value={accountForm.bloodGroup} onChange={(e) => setAccountForm((v) => ({ ...v, bloodGroup: e.target.value }))} required>
              <option value="">Select Blood Group</option>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>
                  {bloodGroupLabel[group]}
                </option>
              ))}
            </select>
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select className="rounded border p-2" value={accountForm.primaryPhoneCode} onChange={(e) => setAccountForm((v) => ({ ...v, primaryPhoneCode: e.target.value }))}>
                {countryCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input className="rounded border p-2" placeholder="Primary Phone Number *" value={accountForm.primaryPhone} onChange={(e) => setAccountForm((v) => ({ ...v, primaryPhone: e.target.value.replace(/\D/g, '') }))} pattern="\d+" inputMode="numeric" required />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select className="rounded border p-2" value={accountForm.alternativePhoneCode} onChange={(e) => setAccountForm((v) => ({ ...v, alternativePhoneCode: e.target.value }))}>
                {countryCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input className="rounded border p-2" placeholder="Alternative Phone Number" value={accountForm.alternativePhone} onChange={(e) => setAccountForm((v) => ({ ...v, alternativePhone: e.target.value.replace(/\D/g, '') }))} pattern="\d*" inputMode="numeric" />
            </div>
            <input className="rounded border p-2" placeholder="Emergency Contact Name *" value={accountForm.emergencyContactName} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select className="rounded border p-2" value={accountForm.emergencyContactCode} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactCode: e.target.value }))}>
                {countryCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input className="rounded border p-2" placeholder="Emergency Contact Phone Number *" value={accountForm.emergencyContactPhone} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactPhone: e.target.value.replace(/\D/g, '') }))} pattern="\d+" inputMode="numeric" title="Number field should contain digits only" required />
            </div>
            <select className="rounded border p-2" value={accountForm.emergencyContactRelationship} onChange={(e) => setAccountForm((v) => ({ ...v, emergencyContactRelationship: e.target.value }))} required>
              <option value="">Relationship to Donor *</option>
              {relationshipOptions.map((relationship) => (
                <option key={relationship} value={relationship}>{relationship}</option>
              ))}
            </select>
          </div>
        ) : null}

        {accountRole === 'HOSPITAL_ADMIN' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Hospital Name" value={accountForm.hospitalName} onChange={(e) => setAccountForm((v) => ({ ...v, hospitalName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))} pattern="[A-Za-z\s'-]+" title="Name should contain letters only" required />
            <input className="rounded border p-2" placeholder="Registration Code" value={accountForm.registrationCode} onChange={(e) => setAccountForm((v) => ({ ...v, registrationCode: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Address" value={accountForm.address} onChange={(e) => setAccountForm((v) => ({ ...v, address: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Location" value={accountForm.location} onChange={(e) => setAccountForm((v) => ({ ...v, location: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="City *" value={accountForm.city} onChange={(e) => setAccountForm((v) => ({ ...v, city: e.target.value }))} required />
            <input className="rounded border p-2" placeholder="Region *" value={accountForm.region} onChange={(e) => setAccountForm((v) => ({ ...v, region: e.target.value }))} required />
            <input className="rounded border bg-slate-50 p-2" placeholder="Latitude (e.g. 5.6698)" inputMode="decimal" value={accountForm.latitude} readOnly />
            <input className="rounded border bg-slate-50 p-2" placeholder="Longitude (e.g. -0.0166)" inputMode="decimal" value={accountForm.longitude} readOnly />
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
            <div className="space-y-2 md:col-span-3">
              <p className="text-sm font-semibold text-slate-700">Select hospital location on the map</p>
              <p className="text-xs text-slate-500">
                These location details are required for emergency requests, nearest blood source search, donor matching, and live map coordination.
              </p>
              <button
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={capturingAccountHospitalLocation}
                type="button"
                onClick={useBrowserLocationForAccountHospital}
              >
                {capturingAccountHospitalLocation ? 'Capturing location...' : 'Use Browser Location'}
              </button>
              <p className="text-xs text-slate-500">Click the hospital location on the map or drag the pin to set coordinates.</p>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <HospitalLocationPicker
                  latitude={accountForm.latitude.trim() ? Number(accountForm.latitude) : null}
                  longitude={accountForm.longitude.trim() ? Number(accountForm.longitude) : null}
                  onChange={(nextLat, nextLng) =>
                    setAccountForm((v) => ({ ...v, latitude: String(nextLat), longitude: String(nextLng) }))
                  }
                  className="h-64 w-full"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 md:col-span-3">
              Latitude and longitude help this hospital appear correctly on the Smart Blood Bank Map.
            </p>
          </div>
        ) : null}

        <button className="btn-primary" type="submit">Create Account</button>
      </form>
      ) : null}

      {activeSection === 'settings' ? (
      <div id="settings" className="card space-y-3">
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
          <table className={`min-w-[920px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b">
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Email</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Role</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Active</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Verification</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Last Delivery</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const lastAttempt = user.emailVerificationAttempts?.[0];
                return (
                  <tr key={user.id} className="border-b">
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{user.email}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{formatRole(user.role)}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{String(user.isActive)}</td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${user.emailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {user.emailVerified ? 'Verified' : 'Pending'}
                      </span>
                      {user.verifiedAt ? <p className="mt-1 text-xs text-slate-500">{new Date(user.verifiedAt).toLocaleString()}</p> : null}
                    </td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                      {lastAttempt ? (
                        <div>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                            lastAttempt.status === 'FAILED'
                              ? 'bg-red-100 text-red-700'
                              : lastAttempt.status === 'SENT' || lastAttempt.status === 'VERIFIED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {lastAttempt.status}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">
                            {lastAttempt.sentAt || lastAttempt.failedAt || lastAttempt.createdAt
                              ? new Date(lastAttempt.sentAt ?? lastAttempt.failedAt ?? lastAttempt.createdAt).toLocaleString()
                              : 'Date not recorded'}
                          </p>
                          {lastAttempt.failureReason ? <p className="max-w-[240px] text-xs text-red-600">{lastAttempt.failureReason}</p> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No attempt recorded</span>
                      )}
                    </td>
                    <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                      <div className="flex flex-wrap gap-2">
                        {!user.emailVerified ? (
                          <>
                            <button className="rounded bg-blue-100 px-3 py-1 text-blue-700" onClick={() => void resendUserVerification(user)}>Resend</button>
                            <button className="rounded bg-green-100 px-3 py-1 text-green-700" onClick={() => setManualVerifyUser(user)}>Verify</button>
                          </>
                        ) : null}
                        <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editUser(user)}>Edit</button>
                        <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteUser(user.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <table className={`min-w-[980px] w-full text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b">
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Donor</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Account Status</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Clinical Eligibility</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Blood Group</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Availability</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDonors.map((donor) => {
                const clinicalStatus = getClinicalStatus(donor);
                return (
                <tr key={donor.id} className="border-b">
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="font-semibold text-slate-900">{donor.fullName}</div>
                    <div className="text-xs text-slate-500">{donor.donorNumber ?? 'No donor number'} • {donor.user.email}</div>
                    <div className="text-xs text-slate-500">{donor.location}</div>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getAccountStatusClass(donor)}`}>
                      {formatAccountStatus(donor)}
                    </span>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getClinicalStatusClass(clinicalStatus)}`}>
                      {formatClinicalStatus(clinicalStatus)}
                    </span>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    {donor.bloodGroup === 'UNKNOWN' ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Pending Confirmation</span>
                    ) : bloodGroupLabel[donor.bloodGroup] ?? donor.bloodGroup}
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${donor.availabilityStatus ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                      {donor.availabilityStatus ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex flex-wrap gap-2">
                      {donor.user.isActive ? (
                        <button className="rounded bg-amber-100 px-3 py-1 text-amber-700" onClick={() => void setDonorAccountStatus(donor.id, false)}>
                          Suspend Account
                        </button>
                      ) : (
                        <button className="rounded bg-green-100 px-3 py-1 text-green-700" onClick={() => void setDonorAccountStatus(donor.id, true)}>
                          Approve Account
                        </button>
                      )}
                      <button className="rounded bg-gray-100 px-3 py-1" onClick={() => void editDonor(donor)}>Edit</button>
                      <button className="rounded bg-red-100 px-3 py-1 text-red-700" onClick={() => void deleteDonor(donor.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
              })}
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
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Map Status</th>
                <th className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHospitals.map((hospital) => (
                <tr key={hospital.id} className="border-b">
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex items-center gap-2">
                      <SmartAvatar name={hospital.hospitalName} src={hospital.logoUrl} size="xs" />
                      <span>{hospital.hospitalName}</span>
                    </div>
                  </td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.user.email}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.registrationCode}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>{hospital.location}</td>
                  <td className={compactDensity ? 'px-3 py-2' : 'px-3 py-3'}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        resolveHospitalMapStatus(hospital) === 'Map Ready'
                          ? 'bg-emerald-100 text-emerald-700'
                          : resolveHospitalMapStatus(hospital) === 'Pending Approval'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {resolveHospitalMapStatus(hospital)}
                      </span>
                      {hospital.isApproved &&
                      hospital.bloodBankAvailable &&
                      !(typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number') ? (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          Coordinates Required
                        </span>
                      ) : null}
                    </div>
                  </td>
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
                  {request.requestReference}: {request.hospital?.hospitalName ?? 'Hospital'} needs {request.bloodGroup} ({request.unitsNeeded} units)
                </p>
                <p className="text-xs text-gray-600">
                  Workflow {request.status} | Tracking {request.trackingStatus} | Need by{' '}
                  {new Date(request.requiredBy).toLocaleString()}
                </p>
                <p className="text-xs text-gray-600">Request Source: {request.requestSource}</p>
                <p className="text-xs text-gray-600">Hospital Reference: {request.hospitalPatientReference ?? 'N/A'}</p>
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
      <div id="audit" className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Audit Logs</h2>
          <p className="text-sm text-muted">
            Review protected admin audit records from the same backend source used by the Admin Dashboard.
          </p>
        </div>
        <AdminAuditLogTable mode="full" compactDensity={compactDensity} />
      </div>
      ) : null}

      {activeSection === 'donor-communications' ? <DonorCommunicationsSection /> : null}
      {activeSection === 'ai-intelligence' ? <AiIntelligencePanel mode="admin" /> : null}
      {activeSection === 'assistant' ? <BloodSosAssistant /> : null}

      <EditModal
        open={Boolean(manualVerifyUser)}
        title="Manual Email Verification"
        description="Use only when the user has been verified through an approved alternative process."
        onClose={() => setManualVerifyUser(null)}
      >
        <form className="grid gap-3" onSubmit={(event) => void submitManualVerification(event)}>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            This action verifies {manualVerifyUser?.email}. Record the method and reason for audit traceability.
          </p>
          <select
            className="rounded border p-2"
            value={manualVerifyForm.method}
            onChange={(event) => setManualVerifyForm((current) => ({ ...current, method: event.target.value }))}
          >
            <option value="USER_CONFIRMED_IN_PERSON">User confirmed in person</option>
            <option value="VERIFIED_BY_PHONE">Verified by phone</option>
            <option value="VERIFIED_AT_HOSPITAL">Verified at hospital/blood bank</option>
            <option value="EMAIL_PROVIDER_FAILURE">Email provider failure</option>
            <option value="OTHER">Other approved reason</option>
          </select>
          <textarea
            className="rounded border p-2"
            minLength={10}
            placeholder="Reason for manual verification *"
            value={manualVerifyForm.reason}
            onChange={(event) => setManualVerifyForm((current) => ({ ...current, reason: event.target.value }))}
            required
          />
          <textarea
            className="rounded border p-2"
            placeholder="Optional note"
            value={manualVerifyForm.note}
            onChange={(event) => setManualVerifyForm((current) => ({ ...current, note: event.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <button className="rounded border px-3 py-2" type="button" onClick={() => setManualVerifyUser(null)}>Cancel</button>
            <button className="btn-primary" disabled={savingModal} type="submit">
              {savingModal ? 'Verifying...' : 'Verify Account'}
            </button>
          </div>
        </form>
      </EditModal>

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
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-bold text-slate-800">Account Information</h3>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Account Status</span>
                  <span className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-semibold ${getAccountStatusClass(editingDonor)}`}>
                    {formatAccountStatus(editingDonor)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Email Verified</span>
                  <span>{editingDonor.user.emailVerified ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Phone Verified</span>
                  <span>{editingDonor.phoneVerified ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Registration Date</span>
                  <span>{formatDateTime(editingDonor.user.createdAt ?? editingDonor.createdAt)}</span>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-bold text-slate-800">Clinical Information</h3>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Health Form Status</span>
                  <span>{editingClinicalRecord ? formatClinicalStatus(editingClinicalRecord.status) : 'Not Started'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Hospital Review Status</span>
                  <span>{editingClinicalRecord?.hospitalReviewedAt ? 'Reviewed' : editingClinicalRecord?.submittedAt ? 'Awaiting Review' : 'Not Submitted'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Office Use Status</span>
                  <span>{editingClinicalRecord?.officeCompletedAt ? 'Office Use Completed' : 'Not Completed'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Clinical Eligibility Decision</span>
                  <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${getClinicalStatusClass(editingClinicalStatus)}`}>
                    {formatClinicalStatus(editingClinicalStatus)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Deferral Status</span>
                  <span>
                    {editingClinicalStatus === 'TEMPORARILY_DEFERRED'
                      ? `Temporarily Deferred${editingClinicalRecord?.clinicalReview?.temporaryDeferralDuration ? ` (${editingClinicalRecord.clinicalReview.temporaryDeferralDuration})` : ''}`
                      : editingClinicalStatus === 'PERMANENTLY_DEFERRED'
                        ? 'Permanently Deferred'
                        : 'Not Deferred'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-slate-500">Last Review Date</span>
                  <span>{formatDateTime(editingClinicalRecord?.clinicalReview?.reviewedAt ?? editingClinicalRecord?.finalDecisionAt ?? editingClinicalRecord?.hospitalReviewedAt)}</span>
                </div>
              </div>
            </section>
            <div className="grid gap-3 md:grid-cols-3">
              <input className="rounded border p-2" placeholder="First Name *" value={editingDonor.firstName} onChange={(e) => setEditingDonor((v) => (v ? { ...v, firstName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') } : v))} required />
              <input className="rounded border p-2" placeholder="Other Name(s)" value={editingDonor.otherNames} onChange={(e) => setEditingDonor((v) => (v ? { ...v, otherNames: e.target.value.replace(/[^A-Za-z\s'-]/g, '') } : v))} />
              <input className="rounded border p-2" placeholder="Surname *" value={editingDonor.surname} onChange={(e) => setEditingDonor((v) => (v ? { ...v, surname: e.target.value.replace(/[^A-Za-z\s'-]/g, '') } : v))} required />
            </div>
            <input className="rounded border bg-gray-50 p-2 text-sm text-slate-600" value={[editingDonor.surname, editingDonor.firstName, editingDonor.otherNames].filter(Boolean).join(' ') || editingDonor.fullName} readOnly />
            <input className="rounded border p-2" placeholder="Primary Phone Number (+233...)" value={editingDonor.phone} onChange={(e) => setEditingDonor((v) => (v ? { ...v, phone: e.target.value } : v))} required />
            <input className="rounded border p-2" placeholder="Alternative Phone Number (Optional)" value={editingDonor.alternativePhoneNumber} onChange={(e) => setEditingDonor((v) => (v ? { ...v, alternativePhoneNumber: e.target.value } : v))} />
            <input className="rounded border p-2" value={editingDonor.location} onChange={(e) => setEditingDonor((v) => (v ? { ...v, location: e.target.value } : v))} required />
            <select className="rounded border p-2" value={editingDonor.bloodGroup} onChange={(e) => setEditingDonor((v) => (v ? { ...v, bloodGroup: e.target.value } : v))}>
              {bloodGroups.map((group) => <option key={group} value={group}>{bloodGroupLabel[group] ?? group}</option>)}
            </select>
            <input className="rounded border p-2" placeholder="Emergency Contact Name *" value={editingDonor.emergencyContactName} onChange={(e) => setEditingDonor((v) => (v ? { ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') } : v))} required />
            <input className="rounded border p-2" placeholder="Emergency Contact Phone Number (+233...)" value={editingDonor.emergencyContactPhone} onChange={(e) => setEditingDonor((v) => (v ? { ...v, emergencyContactPhone: e.target.value } : v))} required />
            <select className="rounded border p-2" value={editingDonor.emergencyContactRelationship} onChange={(e) => setEditingDonor((v) => (v ? { ...v, emergencyContactRelationship: e.target.value } : v))} required>
              <option value="">Relationship to Donor *</option>
              {relationshipOptions.map((relationship) => (
                <option key={relationship} value={relationship}>{relationship}</option>
              ))}
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
            <input className="rounded border p-2" placeholder="City *" value={editingHospital.city} onChange={(e) => setEditingHospital((v) => (v ? { ...v, city: e.target.value } : v))} required />
            <input className="rounded border p-2" placeholder="Region *" value={editingHospital.region} onChange={(e) => setEditingHospital((v) => (v ? { ...v, region: e.target.value } : v))} required />
            <input className="rounded border bg-slate-50 p-2" inputMode="decimal" placeholder="Latitude (e.g. 5.6698)" value={editingHospital.latitude} readOnly />
            <input className="rounded border bg-slate-50 p-2" inputMode="decimal" placeholder="Longitude (e.g. -0.0166)" value={editingHospital.longitude} readOnly />
            <p className="text-xs text-slate-500">
              These location details are required for emergency requests, nearest blood source search, donor matching, and live map coordination.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Select hospital location on the map</p>
              <p className="text-xs text-slate-500">Click the hospital location on the map or drag the pin to set coordinates.</p>
              <button
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={capturingEditHospitalLocation}
                type="button"
                onClick={useBrowserLocationForEditingHospital}
              >
                {capturingEditHospitalLocation ? 'Capturing location...' : 'Use Browser Location'}
              </button>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <HospitalLocationPicker
                  latitude={editingHospital.latitude.trim() ? Number(editingHospital.latitude) : null}
                  longitude={editingHospital.longitude.trim() ? Number(editingHospital.longitude) : null}
                  onChange={(nextLat, nextLng) =>
                    setEditingHospital((v) => (v ? { ...v, latitude: String(nextLat), longitude: String(nextLng) } : v))
                  }
                  className="h-56 w-full"
                />
              </div>
            </div>
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



