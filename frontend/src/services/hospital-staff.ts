import api from './api';

export type DepartmentType =
  | 'BLOOD_BANK'
  | 'EMERGENCY'
  | 'LABORATORY'
  | 'TRANSFUSION'
  | 'OUTPATIENT'
  | 'ADMINISTRATION'
  | 'OTHER';

export type StaffRole =
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'INVENTORY_OFFICER'
  | 'DONOR_REVIEW_OFFICER';

export type StaffAccountStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'INACTIVE';

export type HospitalDepartmentItem = {
  id: string;
  hospitalId: string;
  name: string;
  type: DepartmentType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    staffMembers: number;
  };
};

export type HospitalStaffItem = {
  id: string;
  userId: string;
  hospitalId: string;
  departmentId: string | null;
  employeeCode: string;
  title: string;
  status: StaffAccountStatus;
  isDepartmentHead: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: StaffRole;
    isActive: boolean;
    createdAt?: string;
  };
  department?: HospitalDepartmentItem | null;
  hospital?: {
    id: string;
    hospitalName: string;
  };
};

export type CreateDepartmentPayload = {
  name: string;
  type: DepartmentType;
  description?: string;
  isActive?: boolean;
};

export type CreateStaffPayload = {
  email: string;
  password: string;
  role: StaffRole;
  fullName: string;
  title: string;
  departmentId?: string;
  employeeCode?: string;
  status?: StaffAccountStatus;
  isDepartmentHead?: boolean;
};

export type UpdateStaffPayload = Partial<{
  email: string;
  role: StaffRole;
  fullName: string;
  title: string;
  departmentId: string | null;
  status: StaffAccountStatus;
  isDepartmentHead: boolean;
  isActive: boolean;
}>;

function unwrap<T>(value: T | { data: T }): T {
  if (value && typeof value === 'object' && 'data' in (value as Record<string, unknown>)) {
    return (value as { data: T }).data;
  }
  return value as T;
}

export async function getHospitalDepartments() {
  const { data } = await api.get('/hospitals/departments');
  return unwrap<HospitalDepartmentItem[]>(data);
}

export async function createHospitalDepartment(payload: CreateDepartmentPayload) {
  const { data } = await api.post('/hospitals/departments', payload);
  return unwrap<HospitalDepartmentItem>(data);
}

export async function updateHospitalDepartment(id: string, payload: Partial<CreateDepartmentPayload>) {
  const { data } = await api.patch(`/hospitals/departments/${id}`, payload);
  return unwrap<HospitalDepartmentItem>(data);
}

export async function getHospitalStaff(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/hospitals/staff', { params });
  return unwrap<HospitalStaffItem[]>(data);
}

export async function createHospitalStaff(payload: CreateStaffPayload) {
  const { data } = await api.post('/hospitals/staff', payload);
  return unwrap<HospitalStaffItem>(data);
}

export async function updateHospitalStaff(id: string, payload: UpdateStaffPayload) {
  const { data } = await api.patch(`/hospitals/staff/${id}`, payload);
  return unwrap<HospitalStaffItem>(data);
}

export async function updateHospitalStaffStatus(
  id: string,
  payload: { status: StaffAccountStatus; isActive?: boolean },
) {
  const { data } = await api.patch(`/hospitals/staff/${id}/status`, payload);
  return unwrap<HospitalStaffItem>(data);
}
