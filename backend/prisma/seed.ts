import 'dotenv/config';
import {
  PrismaClient,
  Role,
  PermissionCode,
  DepartmentType,
  StaffAccountStatus,
  BloodGroup,
  RequestType,
  PriorityLevel,
  RequestProgressStatus,
  RequestStatus,
  DonorResponseStatus,
  InventoryChangeType,
  AppointmentStatus,
  NotificationType,
  DonorReviewStatus,
  DonorClinicalStatus,
  ClinicalScreeningOutcome,
  ClinicalYesNo,
  SecurityEventSeverity,
  WebsiteAnnouncementType,
  WebsiteStatisticKey,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const donorSeedProfiles = [
  {
    id: 'seed_donor_1',
    userId: 'seed_user_donor_1',
    email: 'donor1@example.com',
    fullName: 'Ama Mensah',
    bloodGroup: BloodGroup.O_POS,
    location: 'Accra',
    latitude: 5.6037,
    longitude: -0.187,
    phone: '+233200000001',
    emergencyContactName: 'Kojo Mensah',
    emergencyContactPhone: '+233200000021',
    eligibilityStatus: true,
    availabilityStatus: true,
  },
  {
    id: 'seed_donor_2',
    userId: 'seed_user_donor_2',
    email: 'donor2@example.com',
    fullName: 'Michael Asare',
    bloodGroup: BloodGroup.A_NEG,
    location: 'Tema',
    latitude: 5.6698,
    longitude: -0.0166,
    phone: '+233200000003',
    emergencyContactName: 'Grace Asare',
    emergencyContactPhone: '+233200000023',
    eligibilityStatus: false,
    availabilityStatus: false,
  },
  {
    id: 'seed_donor_3',
    userId: 'seed_user_donor_3',
    email: 'donor3@example.com',
    fullName: 'Daniel Owusu',
    bloodGroup: BloodGroup.B_POS,
    location: 'Kumasi',
    latitude: 6.6885,
    longitude: -1.6244,
    phone: '+233200000004',
    emergencyContactName: 'Abena Owusu',
    emergencyContactPhone: '+233200000024',
    eligibilityStatus: true,
    availabilityStatus: true,
  },
  {
    id: 'seed_donor_4',
    userId: 'seed_user_donor_4',
    email: 'donor4@example.com',
    fullName: 'Efua Boateng',
    bloodGroup: BloodGroup.AB_POS,
    location: 'Cape Coast',
    latitude: 5.1053,
    longitude: -1.2466,
    phone: '+233200000005',
    emergencyContactName: 'Yaw Boateng',
    emergencyContactPhone: '+233200000025',
    eligibilityStatus: true,
    availabilityStatus: true,
  },
  {
    id: 'seed_donor_5',
    userId: 'seed_user_donor_5',
    email: 'donor5@example.com',
    fullName: 'Patience Adjei',
    bloodGroup: BloodGroup.O_NEG,
    location: 'Tema',
    latitude: 5.65,
    longitude: -0.02,
    phone: '+233200000006',
    emergencyContactName: 'Kofi Adjei',
    emergencyContactPhone: '+233200000026',
    eligibilityStatus: true,
    availabilityStatus: true,
  },
  {
    id: 'seed_donor_6',
    userId: 'seed_user_donor_6',
    email: 'donor6@example.com',
    fullName: 'Ruth Quaye',
    bloodGroup: BloodGroup.B_NEG,
    location: 'Accra',
    latitude: 5.58,
    longitude: -0.2,
    phone: '+233200000007',
    emergencyContactName: 'Joel Quaye',
    emergencyContactPhone: '+233200000027',
    eligibilityStatus: true,
    availabilityStatus: true,
  },
];

const hospitalSeedProfiles = [
  {
    id: 'seed_hospital_1',
    userId: 'seed_user_hospital_1',
    email: 'cityhospital@example.com',
    hospitalName: 'City Hospital',
    registrationCode: 'CH-001',
    address: '12 Health Avenue',
    location: 'Accra',
    latitude: 5.614818,
    longitude: -0.205874,
    contactName: 'Dr. Evans',
    contactPhone: '+233200000101',
  },
  {
    id: 'seed_hospital_2',
    userId: 'seed_user_hospital_2',
    email: 'temahospital@example.com',
    hospitalName: 'Tema General Hospital',
    registrationCode: 'TG-002',
    address: 'Harbour Road',
    location: 'Tema',
    latitude: 5.6698,
    longitude: -0.0166,
    contactName: 'Dr. Ofori',
    contactPhone: '+233200000102',
  },
  {
    id: 'seed_hospital_3',
    userId: 'seed_user_hospital_3',
    email: 'komfo@example.com',
    hospitalName: 'Komfo Anokye Teaching Hospital',
    registrationCode: 'KATH-003',
    address: 'Bantama Main Road',
    location: 'Kumasi',
    latitude: 6.693,
    longitude: -1.632,
    contactName: 'Dr. Agyeman',
    contactPhone: '+233200000103',
  },
  {
    id: 'seed_hospital_4',
    userId: 'seed_user_hospital_4',
    email: 'korlebu@example.com',
    hospitalName: 'Korle Bu Teaching Hospital Blood Bank',
    registrationCode: 'KBTH-004',
    address: 'Guggisberg Avenue',
    location: 'Korle Bu, Greater Accra',
    latitude: 5.5363,
    longitude: -0.2275,
    contactName: 'Dr. Laryea',
    contactPhone: '+233554287342',
  },
  {
    id: 'seed_hospital_5',
    userId: 'seed_user_hospital_5',
    email: 'hoteaching@example.com',
    hospitalName: 'Ho Teaching Hospital',
    registrationCode: 'HTH-005',
    address: 'Trafalgar Road',
    location: 'Ho, Volta Region',
    latitude: 6.6008,
    longitude: 0.4703,
    contactName: 'Dr. Dzah',
    contactPhone: '+233544515775',
  },
  {
    id: 'seed_hospital_6',
    userId: 'seed_user_hospital_6',
    email: 'homunicipal@example.com',
    hospitalName: 'Ho Municipal Hospital',
    registrationCode: 'HMH-006',
    address: 'Ho Municipal Health District',
    location: 'Ho, Volta Region',
    latitude: 6.6111,
    longitude: 0.4708,
    contactName: 'Dr. Amedzro',
    contactPhone: '+233554287342',
  },
  {
    id: 'seed_hospital_7',
    userId: 'seed_user_hospital_7',
    email: 'capecoast@example.com',
    hospitalName: 'Cape Coast Teaching Hospital',
    registrationCode: 'CCTH-007',
    address: 'Abura Road',
    location: 'Cape Coast, Central Region',
    latitude: 5.1308,
    longitude: -1.2795,
    contactName: 'Dr. Quansah',
    contactPhone: '+233544515775',
  },
  {
    id: 'seed_hospital_8',
    userId: 'seed_user_hospital_8',
    email: '37military@example.com',
    hospitalName: '37 Military Hospital',
    registrationCode: '37MH-008',
    address: 'Liberation Road',
    location: 'Accra, Greater Accra',
    latitude: 5.5887,
    longitude: -0.1851,
    contactName: 'Dr. Mensah',
    contactPhone: '+233554287342',
  },
];

const rolePermissionSeeds: Record<Role, PermissionCode[]> = {
  SUPER_ADMIN: [
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
    PermissionCode.PLATFORM_SECURITY_VIEW,
    PermissionCode.RBAC_MANAGE,
    PermissionCode.HOSPITAL_APPROVE,
    PermissionCode.ACCOUNT_SUSPEND,
    PermissionCode.EMERGENCY_OVERRIDE,
    PermissionCode.NATIONAL_ALERT_BROADCAST,
    PermissionCode.WEBSITE_CONTENT_MANAGE,
    PermissionCode.AUDIT_LOG_VIEW,
    PermissionCode.AUDIT_LOG_EXPORT,
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.HOSPITAL_STAFF_MANAGE,
    PermissionCode.HOSPITAL_SETTINGS_MANAGE,
    PermissionCode.INVENTORY_MANAGE,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.DONOR_REVIEW_MANAGE,
    PermissionCode.DONOR_REVIEW_APPROVE,
    PermissionCode.BLOOD_REQUEST_CREATE,
    PermissionCode.BLOOD_REQUEST_APPROVE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.APPOINTMENT_MANAGE,
    PermissionCode.REPORT_VIEW,
    PermissionCode.SECURITY_MONITOR_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  ADMIN: [
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
    PermissionCode.HOSPITAL_APPROVE,
    PermissionCode.WEBSITE_CONTENT_MANAGE,
    PermissionCode.AUDIT_LOG_VIEW,
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.HOSPITAL_STAFF_MANAGE,
    PermissionCode.INVENTORY_MANAGE,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.DONOR_REVIEW_MANAGE,
    PermissionCode.DONOR_REVIEW_APPROVE,
    PermissionCode.BLOOD_REQUEST_CREATE,
    PermissionCode.BLOOD_REQUEST_APPROVE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.APPOINTMENT_MANAGE,
    PermissionCode.REPORT_VIEW,
    PermissionCode.SECURITY_MONITOR_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  HOSPITAL_ADMIN: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.HOSPITAL_STAFF_MANAGE,
    PermissionCode.HOSPITAL_SETTINGS_MANAGE,
    PermissionCode.INVENTORY_MANAGE,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.DONOR_REVIEW_MANAGE,
    PermissionCode.DONOR_REVIEW_APPROVE,
    PermissionCode.BLOOD_REQUEST_CREATE,
    PermissionCode.BLOOD_REQUEST_APPROVE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.APPOINTMENT_MANAGE,
    PermissionCode.REPORT_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  HOSPITAL_STAFF: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.BLOOD_REQUEST_CREATE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.APPOINTMENT_MANAGE,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  INVENTORY_OFFICER: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.INVENTORY_MANAGE,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  DONOR_REVIEW_OFFICER: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.DONOR_REVIEW_MANAGE,
    PermissionCode.DONOR_REVIEW_APPROVE,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  WEBSITE_CONTENT_ADMIN: [
    PermissionCode.WEBSITE_CONTENT_MANAGE,
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
  ],
  AUDITOR: [
    PermissionCode.AUDIT_LOG_VIEW,
    PermissionCode.AUDIT_LOG_EXPORT,
    PermissionCode.REPORT_VIEW,
    PermissionCode.SECURITY_MONITOR_VIEW,
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  DONOR: [],
};

async function main() {
  const adminPassword = await argon2.hash('AdminPass123!');
  const donorPassword = await argon2.hash('DonorPass123!');
  const hospitalPassword = await argon2.hash('HospitalPass123!');
  const enterprisePassword = await argon2.hash('EnterprisePass123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hospital.org' },
    update: {
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'admin@hospital.org',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'adigblipeteragbeko@gmail.com' },
    update: {
      passwordHash: await argon2.hash('How10are30u'),
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'adigblipeteragbeko@gmail.com',
      passwordHash: await argon2.hash('How10are30u'),
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@bloodresponse.org' },
    update: {
      passwordHash: enterprisePassword,
      role: Role.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'superadmin@bloodresponse.org',
      passwordHash: enterprisePassword,
      role: Role.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });

  const websiteContentAdmin = await prisma.user.upsert({
    where: { email: 'contentadmin@bloodresponse.org' },
    update: {
      passwordHash: enterprisePassword,
      role: Role.WEBSITE_CONTENT_ADMIN,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'contentadmin@bloodresponse.org',
      passwordHash: enterprisePassword,
      role: Role.WEBSITE_CONTENT_ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@bloodresponse.org' },
    update: {
      passwordHash: enterprisePassword,
      role: Role.AUDITOR,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'auditor@bloodresponse.org',
      passwordHash: enterprisePassword,
      role: Role.AUDITOR,
      emailVerified: true,
      isActive: true,
    },
  });

  const donorUsers = new Map<string, { id: string; email: string }>();
  for (const profile of donorSeedProfiles) {
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        passwordHash: donorPassword,
        role: Role.DONOR,
        emailVerified: true,
        isActive: true,
      },
      create: {
        id: profile.userId,
        email: profile.email,
        passwordHash: donorPassword,
        role: Role.DONOR,
        emailVerified: true,
        isActive: true,
      },
      select: { id: true, email: true },
    });
    donorUsers.set(profile.id, user);

    await prisma.donor.upsert({
      where: { userId: user.id },
      update: {
        fullName: profile.fullName,
        bloodGroup: profile.bloodGroup,
        location: profile.location,
        latitude: profile.latitude,
        longitude: profile.longitude,
        phone: profile.phone,
        eligibilityStatus: profile.eligibilityStatus,
        availabilityStatus: profile.availabilityStatus,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
      },
      create: {
        id: profile.id,
        userId: user.id,
        fullName: profile.fullName,
        bloodGroup: profile.bloodGroup,
        location: profile.location,
        latitude: profile.latitude,
        longitude: profile.longitude,
        phone: profile.phone,
        eligibilityStatus: profile.eligibilityStatus,
        availabilityStatus: profile.availabilityStatus,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
      },
    });
  }

  const hospitalUsers = new Map<string, { id: string; email: string }>();
  for (const profile of hospitalSeedProfiles) {
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        passwordHash: hospitalPassword,
        role: Role.HOSPITAL_ADMIN,
        emailVerified: true,
        isActive: true,
      },
      create: {
        id: profile.userId,
        email: profile.email,
        passwordHash: hospitalPassword,
        role: Role.HOSPITAL_ADMIN,
        emailVerified: true,
        isActive: true,
      },
      select: { id: true, email: true },
    });
    hospitalUsers.set(profile.id, user);

    await prisma.hospital.upsert({
      where: { userId: user.id },
      update: {
        hospitalName: profile.hospitalName,
        registrationCode: profile.registrationCode,
        address: profile.address,
        location: profile.location,
        latitude: profile.latitude,
        longitude: profile.longitude,
        contactName: profile.contactName,
        contactPhone: profile.contactPhone,
        isApproved: true,
        approvedAt: new Date(),
        approvedById: superAdmin.id,
        approvalNotes: 'Seeded as approved partner hospital.',
      },
      create: {
        id: profile.id,
        userId: user.id,
        hospitalName: profile.hospitalName,
        registrationCode: profile.registrationCode,
        address: profile.address,
        location: profile.location,
        latitude: profile.latitude,
        longitude: profile.longitude,
        contactName: profile.contactName,
        contactPhone: profile.contactPhone,
        isApproved: true,
        approvedAt: new Date(),
        approvedById: superAdmin.id,
        approvalNotes: 'Seeded as approved partner hospital.',
      },
    });
  }

  const donors = await prisma.donor.findMany({
    where: { userId: { in: Array.from(donorUsers.values()).map((user) => user.id) } },
    include: { user: true },
  });
  const hospitals = await prisma.hospital.findMany({
    where: { userId: { in: Array.from(hospitalUsers.values()).map((user) => user.id) } },
    include: { user: true },
  });

  const donor = donors.find((item) => item.user.email === 'donor1@example.com')!;
  const donorUser = donor.user;
  const hospital = hospitals.find((item) => item.user.email === 'cityhospital@example.com')!;
  const hospitalUser = hospital.user;
  const donorById = Object.fromEntries(
    donorSeedProfiles.map((profile) => [profile.id, donors.find((item) => item.user.email === profile.email)!]),
  ) as Record<string, (typeof donors)[number]>;
  const hospitalById = Object.fromEntries(
    hospitalSeedProfiles.map((profile) => [
      profile.id,
      hospitals.find((item) => item.user.email === profile.email)!,
    ]),
  ) as Record<
    string,
    (typeof hospitals)[number]
  >;

  for (const [role, permissions] of Object.entries(rolePermissionSeeds) as [Role, PermissionCode[]][]) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          role_permission: {
            role,
            permission,
          },
        },
        update: {
          isGranted: true,
        },
        create: {
          role,
          permission,
          isGranted: true,
        },
      });
    }
  }

  const departmentSeeds = [
    {
      id: 'seed_department_1',
      hospitalId: hospitalById.seed_hospital_1.id,
      name: 'Emergency Response Unit',
      type: DepartmentType.EMERGENCY,
      description: 'Coordinates urgent blood requests and trauma response.',
    },
    {
      id: 'seed_department_2',
      hospitalId: hospitalById.seed_hospital_1.id,
      name: 'Blood Bank Operations',
      type: DepartmentType.BLOOD_BANK,
      description: 'Manages blood stock, storage, and issue workflows.',
    },
    {
      id: 'seed_department_3',
      hospitalId: hospitalById.seed_hospital_2.id,
      name: 'Donor Services',
      type: DepartmentType.DONOR_SERVICES,
      description: 'Handles donor intake, review, and scheduling.',
    },
    {
      id: 'seed_department_4',
      hospitalId: hospitalById.seed_hospital_3.id,
      name: 'Compliance and Quality',
      type: DepartmentType.COMPLIANCE,
      description: 'Oversees audit readiness and clinical compliance.',
    },
  ];

  for (const department of departmentSeeds) {
    await prisma.hospitalDepartment.upsert({
      where: { id: department.id },
      update: department,
      create: department,
    });
  }

  const departmentById = Object.fromEntries(
    departmentSeeds.map((department) => [department.id, department]),
  ) as Record<string, (typeof departmentSeeds)[number]>;

  const staffSeeds = [
    {
      userId: 'seed_staff_user_1',
      email: 'ops.staff@cityhospital.org',
      role: Role.HOSPITAL_STAFF,
      hospitalId: hospitalById.seed_hospital_1.id,
      departmentId: 'seed_department_1',
      employeeCode: 'CH-OPS-001',
      title: 'Emergency Operations Officer',
      status: StaffAccountStatus.ACTIVE,
      isDepartmentHead: true,
    },
    {
      userId: 'seed_staff_user_2',
      email: 'inventory.officer@cityhospital.org',
      role: Role.INVENTORY_OFFICER,
      hospitalId: hospitalById.seed_hospital_1.id,
      departmentId: 'seed_department_2',
      employeeCode: 'CH-INV-001',
      title: 'Inventory Control Officer',
      status: StaffAccountStatus.ACTIVE,
      isDepartmentHead: true,
    },
    {
      userId: 'seed_staff_user_3',
      email: 'review.officer@temahospital.org',
      role: Role.DONOR_REVIEW_OFFICER,
      hospitalId: hospitalById.seed_hospital_2.id,
      departmentId: 'seed_department_3',
      employeeCode: 'TG-DR-001',
      title: 'Donor Review Officer',
      status: StaffAccountStatus.ACTIVE,
      isDepartmentHead: true,
    },
    {
      userId: 'seed_staff_user_4',
      email: 'compliance.lead@komfo.org',
      role: Role.HOSPITAL_STAFF,
      hospitalId: hospitalById.seed_hospital_3.id,
      departmentId: 'seed_department_4',
      employeeCode: 'KATH-COMP-001',
      title: 'Compliance Operations Lead',
      status: StaffAccountStatus.ACTIVE,
      isDepartmentHead: true,
    },
  ];

  const staffUsersByEmail = new Map<string, { id: string; role: Role }>();
  for (const staff of staffSeeds) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        passwordHash: enterprisePassword,
        role: staff.role,
        emailVerified: true,
        isActive: true,
      },
      create: {
        id: staff.userId,
        email: staff.email,
        passwordHash: enterprisePassword,
        role: staff.role,
        emailVerified: true,
        isActive: true,
      },
      select: { id: true, role: true },
    });

    staffUsersByEmail.set(staff.email, user);

    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        hospitalId: staff.hospitalId,
        departmentId: staff.departmentId,
        employeeCode: staff.employeeCode,
        title: staff.title,
        status: staff.status,
        isDepartmentHead: staff.isDepartmentHead,
      },
      create: {
        userId: user.id,
        hospitalId: staff.hospitalId,
        departmentId: staff.departmentId,
        employeeCode: staff.employeeCode,
        title: staff.title,
        status: staff.status,
        isDepartmentHead: staff.isDepartmentHead,
      },
    });
  }

  const inventoryItem = await prisma.inventoryItem.upsert({
    where: { hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: BloodGroup.O_POS } },
    update: { availableUnits: 12, updatedById: hospitalUser.id },
    create: {
      hospitalId: hospital.id,
      bloodGroup: BloodGroup.O_POS,
      availableUnits: 12,
      updatedById: hospitalUser.id,
    },
  });

  const existingRequest = await prisma.bloodRequest.findFirst({
    where: {
      hospitalId: hospital.id,
      bloodGroup: BloodGroup.O_POS,
      type: RequestType.EMERGENCY,
      location: 'Accra',
    },
    orderBy: { createdAt: 'desc' },
  });

  const bloodRequest =
    existingRequest ??
    (await prisma.bloodRequest.create({
      data: {
        hospitalId: hospital.id,
        bloodGroup: BloodGroup.O_POS,
        unitsNeeded: 4,
        type: RequestType.EMERGENCY,
        priority: PriorityLevel.CRITICAL,
        status: RequestStatus.MATCHING,
        trackingStatus: RequestProgressStatus.MATCHED,
        location: 'Accra',
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        requiredBy: new Date(Date.now() + 3 * 60 * 60 * 1000),
        notes: 'Road traffic emergency case.',
        matchedDonors: { connect: [{ id: donor.id }] },
      },
    }));

  await prisma.bloodRequest.update({
    where: { id: bloodRequest.id },
    data: {
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      matchedDonors: { connect: [{ id: donor.id }] },
    },
  });

  await prisma.bloodRequestUpdate.upsert({
    where: {
      id: `${bloodRequest.id}_seed_request_update`,
    },
    update: {
      oldStatus: RequestProgressStatus.PENDING,
      newStatus: RequestProgressStatus.MATCHED,
      comment: 'Seeded request tracking update',
      updatedById: hospitalUser.id,
    },
    create: {
      id: `${bloodRequest.id}_seed_request_update`,
      bloodRequestId: bloodRequest.id,
      updatedById: hospitalUser.id,
      oldStatus: RequestProgressStatus.PENDING,
      newStatus: RequestProgressStatus.MATCHED,
      comment: 'Seeded request tracking update',
    },
  });

  await prisma.donorResponse.upsert({
    where: {
      bloodRequestId_donorId: {
        bloodRequestId: bloodRequest.id,
        donorId: donor.id,
      },
    },
    update: {
      responseStatus: DonorResponseStatus.ACCEPTED,
      responseTime: new Date(),
      notes: 'I can donate within one hour.',
    },
    create: {
      bloodRequestId: bloodRequest.id,
      donorId: donor.id,
      responseStatus: DonorResponseStatus.ACCEPTED,
      responseTime: new Date(),
      notes: 'I can donate within one hour.',
      userId: donorUser.id,
    },
  });

  const existingInventoryLog = await prisma.inventoryLog.findFirst({
    where: {
      inventoryId: inventoryItem.id,
      reason: 'Seed baseline inventory log',
    },
  });

  if (!existingInventoryLog) {
    await prisma.inventoryLog.create({
      data: {
        inventoryId: inventoryItem.id,
        changeType: InventoryChangeType.ADJUSTED,
        unitsChanged: 0,
        previousUnits: inventoryItem.availableUnits,
        newUnits: inventoryItem.availableUnits,
        reason: 'Seed baseline inventory log',
        changedById: hospitalUser.id,
      },
    });
  }

  const inventorySeeds = [
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.O_POS, availableUnits: 12, expiringUnits: 1, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.O_NEG, availableUnits: 2, expiringUnits: 1, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.A_POS, availableUnits: 9, expiringUnits: 0, lowThreshold: 6, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.A_NEG, availableUnits: 3, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.B_POS, availableUnits: 6, expiringUnits: 0, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.B_NEG, availableUnits: 1, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.AB_POS, availableUnits: 4, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_1', bloodGroup: BloodGroup.AB_NEG, availableUnits: 1, expiringUnits: 0, lowThreshold: 3, criticalThreshold: 1 },
    { hospitalId: 'seed_hospital_2', bloodGroup: BloodGroup.O_POS, availableUnits: 10, expiringUnits: 0, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_2', bloodGroup: BloodGroup.O_NEG, availableUnits: 1, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_2', bloodGroup: BloodGroup.A_POS, availableUnits: 7, expiringUnits: 1, lowThreshold: 6, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_2', bloodGroup: BloodGroup.B_POS, availableUnits: 2, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_3', bloodGroup: BloodGroup.O_POS, availableUnits: 8, expiringUnits: 0, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_3', bloodGroup: BloodGroup.A_NEG, availableUnits: 2, expiringUnits: 0, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_3', bloodGroup: BloodGroup.B_NEG, availableUnits: 2, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_3', bloodGroup: BloodGroup.AB_POS, availableUnits: 3, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_4', bloodGroup: BloodGroup.O_POS, availableUnits: 16, expiringUnits: 2, lowThreshold: 8, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_4', bloodGroup: BloodGroup.O_NEG, availableUnits: 4, expiringUnits: 1, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_4', bloodGroup: BloodGroup.A_POS, availableUnits: 11, expiringUnits: 1, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_4', bloodGroup: BloodGroup.B_POS, availableUnits: 9, expiringUnits: 0, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_4', bloodGroup: BloodGroup.AB_NEG, availableUnits: 1, expiringUnits: 0, lowThreshold: 3, criticalThreshold: 1 },
    { hospitalId: 'seed_hospital_5', bloodGroup: BloodGroup.O_POS, availableUnits: 6, expiringUnits: 1, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_5', bloodGroup: BloodGroup.A_POS, availableUnits: 5, expiringUnits: 0, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_5', bloodGroup: BloodGroup.B_POS, availableUnits: 3, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_6', bloodGroup: BloodGroup.O_POS, availableUnits: 4, expiringUnits: 0, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_6', bloodGroup: BloodGroup.O_NEG, availableUnits: 1, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 1 },
    { hospitalId: 'seed_hospital_6', bloodGroup: BloodGroup.A_NEG, availableUnits: 1, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 1 },
    { hospitalId: 'seed_hospital_7', bloodGroup: BloodGroup.O_POS, availableUnits: 7, expiringUnits: 1, lowThreshold: 7, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_7', bloodGroup: BloodGroup.B_POS, availableUnits: 6, expiringUnits: 0, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_7', bloodGroup: BloodGroup.AB_POS, availableUnits: 2, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 1 },
    { hospitalId: 'seed_hospital_8', bloodGroup: BloodGroup.O_NEG, availableUnits: 3, expiringUnits: 1, lowThreshold: 5, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_8', bloodGroup: BloodGroup.O_POS, availableUnits: 14, expiringUnits: 1, lowThreshold: 8, criticalThreshold: 3 },
    { hospitalId: 'seed_hospital_8', bloodGroup: BloodGroup.A_POS, availableUnits: 8, expiringUnits: 1, lowThreshold: 6, criticalThreshold: 2 },
    { hospitalId: 'seed_hospital_8', bloodGroup: BloodGroup.B_NEG, availableUnits: 2, expiringUnits: 0, lowThreshold: 4, criticalThreshold: 1 },
  ];

  for (const seed of inventorySeeds) {
    const targetHospital = hospitalById[seed.hospitalId];
    const inventory = await prisma.inventoryItem.upsert({
      where: { hospitalId_bloodGroup: { hospitalId: targetHospital.id, bloodGroup: seed.bloodGroup } },
      update: {
        availableUnits: seed.availableUnits,
        expiringUnits: seed.expiringUnits,
        lowThreshold: seed.lowThreshold,
        criticalThreshold: seed.criticalThreshold,
        updatedById: targetHospital.user.id,
      },
      create: {
        hospitalId: targetHospital.id,
        bloodGroup: seed.bloodGroup,
        availableUnits: seed.availableUnits,
        expiringUnits: seed.expiringUnits,
        lowThreshold: seed.lowThreshold,
        criticalThreshold: seed.criticalThreshold,
        updatedById: targetHospital.user.id,
      },
    });

    await prisma.inventoryLog.upsert({
      where: { id: `inventory_log_${seed.hospitalId}_${seed.bloodGroup}` },
      update: {
        previousUnits: seed.availableUnits,
        newUnits: seed.availableUnits,
        reason: 'Seeded command center baseline inventory',
      },
      create: {
        id: `inventory_log_${seed.hospitalId}_${seed.bloodGroup}`,
        inventoryId: inventory.id,
        changeType: InventoryChangeType.ADJUSTED,
        unitsChanged: 0,
        previousUnits: seed.availableUnits,
        newUnits: seed.availableUnits,
        reason: 'Seeded command center baseline inventory',
        changedById: targetHospital.user.id,
      },
    });
  }

  const additionalBloodRequests = [
    {
      id: 'seed_request_2',
      hospitalId: 'seed_hospital_2',
      patientName: 'Yaw Kwarteng',
      patientCode: 'TGH-ER-4021',
      bloodGroup: BloodGroup.O_NEG,
      unitsNeeded: 3,
      type: RequestType.EMERGENCY,
      priority: PriorityLevel.CRITICAL,
      status: RequestStatus.OPEN,
      trackingStatus: RequestProgressStatus.PENDING,
      location: 'Tema',
      latitude: 5.6698,
      longitude: -0.0166,
      notes: 'Emergency surgery case awaiting immediate cross-match.',
      requiredBy: new Date(Date.now() + 90 * 60 * 1000),
      matchedDonorIds: ['seed_donor_5'],
      updates: [
        {
          id: 'seed_request_2_update_1',
          oldStatus: null,
          newStatus: RequestProgressStatus.PENDING,
          comment: 'Emergency request opened by Tema General Hospital.',
          updatedById: hospitalById.seed_hospital_2.user.id,
        },
      ],
      responses: [
        {
          donorId: 'seed_donor_5',
          responseStatus: DonorResponseStatus.PENDING,
          responseTime: null,
          notes: 'Urgent notification sent to donor.',
        },
      ],
    },
    {
      id: 'seed_request_3',
      hospitalId: 'seed_hospital_3',
      patientName: 'Adwoa Nyame',
      patientCode: 'KATH-WARD-298',
      bloodGroup: BloodGroup.B_NEG,
      unitsNeeded: 2,
      type: RequestType.EMERGENCY,
      priority: PriorityLevel.HIGH,
      status: RequestStatus.MATCHING,
      trackingStatus: RequestProgressStatus.MATCHED,
      location: 'Kumasi',
      latitude: 6.693,
      longitude: -1.632,
      notes: 'Post-partum haemorrhage case with urgent monitoring.',
      requiredBy: new Date(Date.now() + 4 * 60 * 60 * 1000),
      matchedDonorIds: ['seed_donor_6', 'seed_donor_3'],
      updates: [
        {
          id: 'seed_request_3_update_1',
          oldStatus: RequestProgressStatus.PENDING,
          newStatus: RequestProgressStatus.MATCHED,
          comment: 'Two compatible donors identified for dispatch.',
          updatedById: hospitalById.seed_hospital_3.user.id,
        },
      ],
      responses: [
        {
          donorId: 'seed_donor_6',
          responseStatus: DonorResponseStatus.ACCEPTED,
          responseTime: new Date(Date.now() - 45 * 60 * 1000),
          notes: 'Donor en route to hospital.',
        },
        {
          donorId: 'seed_donor_3',
          responseStatus: DonorResponseStatus.DECLINED,
          responseTime: new Date(Date.now() - 30 * 60 * 1000),
          notes: 'Out of town but unavailable today.',
        },
      ],
    },
    {
      id: 'seed_request_4',
      hospitalId: 'seed_hospital_1',
      patientName: 'Kojo Frimpong',
      patientCode: 'CH-ICU-188',
      bloodGroup: BloodGroup.A_POS,
      unitsNeeded: 2,
      type: RequestType.STANDARD,
      priority: PriorityLevel.MEDIUM,
      status: RequestStatus.MATCHING,
      trackingStatus: RequestProgressStatus.IN_PROGRESS,
      location: 'Accra',
      latitude: 5.614818,
      longitude: -0.205874,
      notes: 'Planned theatre support request.',
      requiredBy: new Date(Date.now() + 10 * 60 * 60 * 1000),
      matchedDonorIds: ['seed_donor_1'],
      updates: [
        {
          id: 'seed_request_4_update_1',
          oldStatus: RequestProgressStatus.MATCHED,
          newStatus: RequestProgressStatus.IN_PROGRESS,
          comment: 'Screening completed and donation slot confirmed.',
          updatedById: hospitalById.seed_hospital_1.user.id,
        },
      ],
      responses: [
        {
          donorId: 'seed_donor_1',
          responseStatus: DonorResponseStatus.ACCEPTED,
          responseTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          notes: 'Scheduled for planned donation.',
        },
      ],
    },
    {
      id: 'seed_request_5',
      hospitalId: 'seed_hospital_2',
      patientName: 'Mabel Tetteh',
      patientCode: 'TGH-OBS-990',
      bloodGroup: BloodGroup.AB_POS,
      unitsNeeded: 1,
      type: RequestType.STANDARD,
      priority: PriorityLevel.LOW,
      status: RequestStatus.FULFILLED,
      trackingStatus: RequestProgressStatus.COMPLETED,
      location: 'Tema',
      latitude: 5.6698,
      longitude: -0.0166,
      notes: 'Completed replenishment after scheduled donation.',
      requiredBy: new Date(Date.now() - 24 * 60 * 60 * 1000),
      matchedDonorIds: ['seed_donor_4'],
      updates: [
        {
          id: 'seed_request_5_update_1',
          oldStatus: RequestProgressStatus.IN_PROGRESS,
          newStatus: RequestProgressStatus.COMPLETED,
          comment: 'Request fulfilled and stock rebalanced.',
          updatedById: hospitalById.seed_hospital_2.user.id,
        },
      ],
      responses: [
        {
          donorId: 'seed_donor_4',
          responseStatus: DonorResponseStatus.DONATED,
          responseTime: new Date(Date.now() - 26 * 60 * 60 * 1000),
          notes: 'Donation completed successfully.',
        },
      ],
    },
    {
      id: 'seed_request_6',
      hospitalId: 'seed_hospital_3',
      patientName: 'Josephine Addo',
      patientCode: 'KATH-ER-122',
      bloodGroup: BloodGroup.A_NEG,
      unitsNeeded: 4,
      type: RequestType.EMERGENCY,
      priority: PriorityLevel.CRITICAL,
      status: RequestStatus.CANCELLED,
      trackingStatus: RequestProgressStatus.CANCELLED,
      location: 'Kumasi',
      latitude: 6.693,
      longitude: -1.632,
      notes: 'Cancelled after alternate referral supply arrived.',
      requiredBy: new Date(Date.now() - 90 * 60 * 1000),
      matchedDonorIds: ['seed_donor_2'],
      updates: [
        {
          id: 'seed_request_6_update_1',
          oldStatus: RequestProgressStatus.MATCHED,
          newStatus: RequestProgressStatus.CANCELLED,
          comment: 'External transfer resolved the request.',
          updatedById: hospitalById.seed_hospital_3.user.id,
        },
      ],
      responses: [
        {
          donorId: 'seed_donor_2',
          responseStatus: DonorResponseStatus.DECLINED,
          responseTime: new Date(Date.now() - 100 * 60 * 1000),
          notes: 'Temporarily ineligible to donate.',
        },
      ],
    },
  ];

  for (const requestSeed of additionalBloodRequests) {
    const requestHospital = hospitalById[requestSeed.hospitalId];
    const request = await prisma.bloodRequest.upsert({
      where: { id: requestSeed.id },
      update: {
        hospitalId: requestHospital.id,
        patientName: requestSeed.patientName,
        patientCode: requestSeed.patientCode,
        bloodGroup: requestSeed.bloodGroup,
        unitsNeeded: requestSeed.unitsNeeded,
        type: requestSeed.type,
        priority: requestSeed.priority,
        status: requestSeed.status,
        trackingStatus: requestSeed.trackingStatus,
        location: requestSeed.location,
        latitude: requestSeed.latitude,
        longitude: requestSeed.longitude,
        notes: requestSeed.notes,
        requiredBy: requestSeed.requiredBy,
      },
      create: {
        id: requestSeed.id,
        hospitalId: requestHospital.id,
        patientName: requestSeed.patientName,
        patientCode: requestSeed.patientCode,
        bloodGroup: requestSeed.bloodGroup,
        unitsNeeded: requestSeed.unitsNeeded,
        type: requestSeed.type,
        priority: requestSeed.priority,
        status: requestSeed.status,
        trackingStatus: requestSeed.trackingStatus,
        location: requestSeed.location,
        latitude: requestSeed.latitude,
        longitude: requestSeed.longitude,
        notes: requestSeed.notes,
        requiredBy: requestSeed.requiredBy,
      },
    });

    await prisma.bloodRequest.update({
      where: { id: request.id },
      data: {
        matchedDonors: {
          set: [],
          connect: requestSeed.matchedDonorIds.map((donorId) => ({ id: donorById[donorId].id })),
        },
      },
    });

    for (const update of requestSeed.updates) {
      await prisma.bloodRequestUpdate.upsert({
        where: { id: update.id },
        update: {
          bloodRequestId: request.id,
          updatedById: update.updatedById,
          oldStatus: update.oldStatus,
          newStatus: update.newStatus,
          comment: update.comment,
        },
        create: {
          id: update.id,
          bloodRequestId: request.id,
          updatedById: update.updatedById,
          oldStatus: update.oldStatus,
          newStatus: update.newStatus,
          comment: update.comment,
        },
      });
    }

    for (const response of requestSeed.responses) {
      const responder = donorById[response.donorId];
      await prisma.donorResponse.upsert({
        where: {
          bloodRequestId_donorId: {
            bloodRequestId: request.id,
            donorId: responder.id,
          },
        },
        update: {
          responseStatus: response.responseStatus,
          responseTime: response.responseTime,
          notes: response.notes,
          userId: responder.user.id,
        },
        create: {
          bloodRequestId: request.id,
          donorId: responder.id,
          responseStatus: response.responseStatus,
          responseTime: response.responseTime,
          notes: response.notes,
          userId: responder.user.id,
        },
      });
    }
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: { donorId: donor.id, hospitalId: hospital.id, bloodRequestId: bloodRequest.id },
  });

  if (!existingAppointment) {
    await prisma.appointment.create({
      data: {
        donorId: donor.id,
        hospitalId: hospital.id,
        bloodRequestId: bloodRequest.id,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: AppointmentStatus.SCHEDULED,
        notes: 'Seeded appointment for emergency request',
      },
    });
  }

  const existingDonation = await prisma.donation.findFirst({
    where: { donorId: donor.id, hospitalId: hospital.id, bloodRequestId: bloodRequest.id },
  });

  if (!existingDonation) {
    await prisma.donation.create({
      data: {
        donorId: donor.id,
        hospitalId: hospital.id,
        bloodRequestId: bloodRequest.id,
        bloodGroup: BloodGroup.O_POS,
        donatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        unitsDonated: 1,
        location: 'Accra',
        screeningResult: 'Cleared',
        notes: 'Seeded historical donation record',
      },
    });
  }

  const appointmentSeeds = [
    {
      id: 'seed_appointment_2',
      donorId: 'seed_donor_6',
      hospitalId: 'seed_hospital_3',
      bloodRequestId: 'seed_request_3',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      notes: 'Emergency response donor arrival confirmed.',
    },
    {
      id: 'seed_appointment_3',
      donorId: 'seed_donor_4',
      hospitalId: 'seed_hospital_2',
      bloodRequestId: 'seed_request_5',
      scheduledAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      status: AppointmentStatus.COMPLETED,
      notes: 'Completed scheduled donation for AB+ unit replenishment.',
    },
    {
      id: 'seed_appointment_4',
      donorId: 'seed_donor_2',
      hospitalId: 'seed_hospital_3',
      bloodRequestId: 'seed_request_6',
      scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: AppointmentStatus.CANCELLED,
      notes: 'Cancelled after request was resolved externally.',
    },
  ];

  for (const appointment of appointmentSeeds) {
    const appointmentDonor = donorById[appointment.donorId];
    const appointmentHospital = hospitalById[appointment.hospitalId];
    await prisma.appointment.upsert({
      where: { id: appointment.id },
      update: {
        donorId: appointmentDonor.id,
        hospitalId: appointmentHospital.id,
        bloodRequestId: appointment.bloodRequestId,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        notes: appointment.notes,
      },
      create: {
        id: appointment.id,
        donorId: appointmentDonor.id,
        hospitalId: appointmentHospital.id,
        bloodRequestId: appointment.bloodRequestId,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        notes: appointment.notes,
      },
    });
  }

  const donationSeeds = [
    {
      id: 'seed_donation_2',
      donorId: 'seed_donor_4',
      hospitalId: 'seed_hospital_2',
      bloodRequestId: 'seed_request_5',
      bloodGroup: BloodGroup.AB_POS,
      donatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      unitsDonated: 1,
      location: 'Tema',
      screeningResult: 'Cleared',
      notes: 'Scheduled replenishment donation completed.',
    },
    {
      id: 'seed_donation_3',
      donorId: 'seed_donor_5',
      hospitalId: 'seed_hospital_2',
      bloodRequestId: null,
      bloodGroup: BloodGroup.O_NEG,
      donatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      unitsDonated: 1,
      location: 'Tema',
      screeningResult: 'Cleared',
      notes: 'Community donor drive contribution.',
    },
    {
      id: 'seed_donation_4',
      donorId: 'seed_donor_3',
      hospitalId: 'seed_hospital_3',
      bloodRequestId: null,
      bloodGroup: BloodGroup.B_POS,
      donatedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
      unitsDonated: 2,
      location: 'Kumasi',
      screeningResult: 'Cleared',
      notes: 'Regional blood reserve top-up.',
    },
  ];

  for (const donationSeed of donationSeeds) {
    const donationDonor = donorById[donationSeed.donorId];
    const donationHospital = hospitalById[donationSeed.hospitalId];
    await prisma.donation.upsert({
      where: { id: donationSeed.id },
      update: {
        donorId: donationDonor.id,
        hospitalId: donationHospital.id,
        bloodRequestId: donationSeed.bloodRequestId,
        bloodGroup: donationSeed.bloodGroup,
        donatedAt: donationSeed.donatedAt,
        unitsDonated: donationSeed.unitsDonated,
        location: donationSeed.location,
        screeningResult: donationSeed.screeningResult,
        notes: donationSeed.notes,
      },
      create: {
        id: donationSeed.id,
        donorId: donationDonor.id,
        hospitalId: donationHospital.id,
        bloodRequestId: donationSeed.bloodRequestId,
        bloodGroup: donationSeed.bloodGroup,
        donatedAt: donationSeed.donatedAt,
        unitsDonated: donationSeed.unitsDonated,
        location: donationSeed.location,
        screeningResult: donationSeed.screeningResult,
        notes: donationSeed.notes,
      },
    });
  }

  await prisma.notification.upsert({
    where: { id: `${bloodRequest.id}_seed_donor_notification` },
    update: {
      userId: donorUser.id,
      bloodRequestId: bloodRequest.id,
      type: NotificationType.EMERGENCY_REQUEST,
      title: 'Emergency O+ request',
      body: 'City Hospital needs O+ units urgently.',
      channel: 'IN_APP',
      delivered: true,
    },
    create: {
      id: `${bloodRequest.id}_seed_donor_notification`,
      userId: donorUser.id,
      bloodRequestId: bloodRequest.id,
      type: NotificationType.EMERGENCY_REQUEST,
      title: 'Emergency O+ request',
      body: 'City Hospital needs O+ units urgently.',
      channel: 'IN_APP',
      delivered: true,
    },
  });

  await prisma.notification.upsert({
    where: { id: `${bloodRequest.id}_seed_hospital_notification` },
    update: {
      userId: hospitalUser.id,
      bloodRequestId: bloodRequest.id,
      type: NotificationType.SYSTEM,
      title: 'Donor matched',
      body: 'A compatible donor has accepted the emergency request.',
      channel: 'IN_APP',
      delivered: true,
    },
    create: {
      id: `${bloodRequest.id}_seed_hospital_notification`,
      userId: hospitalUser.id,
      bloodRequestId: bloodRequest.id,
      type: NotificationType.SYSTEM,
      title: 'Donor matched',
      body: 'A compatible donor has accepted the emergency request.',
      channel: 'IN_APP',
      delivered: true,
    },
  });

  const donorReviewSeeds = [
    {
      id: 'seed_review_1',
      donorId: 'seed_donor_2',
      selectedHospitalId: 'seed_hospital_2',
      status: DonorReviewStatus.SUBMITTED,
      reviewNotes: 'Awaiting first clinical assessment.',
      officeUseNotes: null,
      clinicalRiskFlag: false,
      clinicalRiskNotes: null,
      reviewerId: null,
      submittedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      hospitalReviewedAt: null,
      officeCompletedAt: null,
      approvedAt: null,
      rejectedAt: null,
    },
    {
      id: 'seed_review_2',
      donorId: 'seed_donor_3',
      selectedHospitalId: 'seed_hospital_3',
      status: DonorReviewStatus.HOSPITAL_REVIEW,
      reviewNotes: 'Awaiting haemoglobin confirmation.',
      officeUseNotes: null,
      clinicalRiskFlag: true,
      clinicalRiskNotes: 'Borderline haemoglobin level flagged for manual confirmation before final approval.',
      reviewerId: staffUsersByEmail.get('review.officer@temahospital.org')?.id ?? hospitalById.seed_hospital_3.user.id,
      submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      hospitalReviewedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      officeCompletedAt: null,
      approvedAt: null,
      rejectedAt: null,
    },
    {
      id: 'seed_review_3',
      donorId: 'seed_donor_4',
      selectedHospitalId: 'seed_hospital_1',
      status: DonorReviewStatus.OFFICE_USE_COMPLETED,
      reviewNotes: 'Vitals within range; office checklist completed.',
      officeUseNotes: 'Ready for admin approval.',
      clinicalRiskFlag: false,
      clinicalRiskNotes: null,
      reviewerId: admin.id,
      submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      hospitalReviewedAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
      officeCompletedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      approvedAt: null,
      rejectedAt: null,
    },
    {
      id: 'seed_review_4',
      donorId: 'seed_donor_5',
      selectedHospitalId: 'seed_hospital_2',
      status: DonorReviewStatus.APPROVED,
      reviewNotes: 'Cleared for emergency response mobilization.',
      officeUseNotes: 'Approved for active donor pool.',
      clinicalRiskFlag: false,
      clinicalRiskNotes: null,
      reviewerId: admin.id,
      submittedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      hospitalReviewedAt: new Date(Date.now() - 70 * 60 * 60 * 1000),
      officeCompletedAt: new Date(Date.now() - 68 * 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 66 * 60 * 60 * 1000),
      rejectedAt: null,
    },
    {
      id: 'seed_review_5',
      donorId: 'seed_donor_6',
      selectedHospitalId: 'seed_hospital_1',
      status: DonorReviewStatus.REJECTED,
      reviewNotes: 'Temporary clinical deferral issued.',
      officeUseNotes: 'Follow-up recommended after recovery period.',
      clinicalRiskFlag: true,
      clinicalRiskNotes: 'Recent medication history requires waiting period before donation can resume.',
      reviewerId: admin.id,
      submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      hospitalReviewedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
      officeCompletedAt: new Date(Date.now() - 44 * 60 * 60 * 1000),
      approvedAt: null,
      rejectedAt: new Date(Date.now() - 42 * 60 * 60 * 1000),
    },
  ];

  for (const review of donorReviewSeeds) {
    const reviewDonor = donorById[review.donorId];
    const reviewHospital = review.selectedHospitalId ? hospitalById[review.selectedHospitalId] : null;
    await prisma.donorEligibilityReview.upsert({
      where: { id: review.id },
      update: {
        donorId: reviewDonor.id,
        selectedHospitalId: reviewHospital?.id ?? null,
        status: review.status,
        reviewNotes: review.reviewNotes,
        officeUseNotes: review.officeUseNotes,
        clinicalRiskFlag: review.clinicalRiskFlag,
        clinicalRiskNotes: review.clinicalRiskNotes,
        reviewerId: review.reviewerId,
        submittedAt: review.submittedAt,
        hospitalReviewedAt: review.hospitalReviewedAt,
        officeCompletedAt: review.officeCompletedAt,
        approvedAt: review.approvedAt,
        rejectedAt: review.rejectedAt,
      },
      create: {
        id: review.id,
        donorId: reviewDonor.id,
        selectedHospitalId: reviewHospital?.id ?? null,
        status: review.status,
        reviewNotes: review.reviewNotes,
        officeUseNotes: review.officeUseNotes,
        clinicalRiskFlag: review.clinicalRiskFlag,
        clinicalRiskNotes: review.clinicalRiskNotes,
        reviewerId: review.reviewerId,
        submittedAt: review.submittedAt,
        hospitalReviewedAt: review.hospitalReviewedAt,
        officeCompletedAt: review.officeCompletedAt,
        approvedAt: review.approvedAt,
        rejectedAt: review.rejectedAt,
      },
    });
  }

  const activitySeeds = [
    {
      id: 'seed_activity_1',
      actorUserId: donorById.seed_donor_1.user.id,
      actorName: donorById.seed_donor_1.fullName,
      type: 'NEW_DONOR_REGISTERED',
      module: 'DONORS',
      title: 'New donor profile created',
      description: 'Ama Mensah completed donor onboarding and verification.',
      entityType: 'DONOR',
      entityId: donorById.seed_donor_1.id,
      donorId: donorById.seed_donor_1.id,
    },
    {
      id: 'seed_activity_2',
      actorUserId: hospitalById.seed_hospital_2.user.id,
      actorName: hospitalById.seed_hospital_2.hospitalName,
      type: 'EMERGENCY_REQUEST_CREATED',
      module: 'REQUESTS',
      title: 'Critical O- request created',
      description: 'Tema General Hospital opened a critical O- emergency request.',
      entityType: 'BLOOD_REQUEST',
      entityId: 'seed_request_2',
      hospitalId: hospitalById.seed_hospital_2.id,
      bloodRequestId: 'seed_request_2',
    },
    {
      id: 'seed_activity_3',
      actorUserId: donorById.seed_donor_6.user.id,
      actorName: donorById.seed_donor_6.fullName,
      type: 'DONOR_ACCEPTED_REQUEST',
      module: 'REQUESTS',
      title: 'Donor accepted emergency call',
      description: 'Ruth Quaye accepted a B- emergency response request.',
      entityType: 'DONOR_RESPONSE',
      entityId: 'seed_request_3',
      donorId: donorById.seed_donor_6.id,
      hospitalId: hospitalById.seed_hospital_3.id,
      bloodRequestId: 'seed_request_3',
    },
    {
      id: 'seed_activity_4',
      actorUserId: hospitalById.seed_hospital_1.user.id,
      actorName: hospitalById.seed_hospital_1.hospitalName,
      type: 'INVENTORY_UPDATED',
      module: 'INVENTORY',
      title: 'Inventory adjusted for O-',
      description: 'City Hospital inventory thresholds were updated for O-.',
      entityType: 'INVENTORY_ITEM',
      entityId: 'seed_hospital_1_O_NEG',
      hospitalId: hospitalById.seed_hospital_1.id,
    },
    {
      id: 'seed_activity_5',
      actorUserId: admin.id,
      actorName: 'Hospital Admin',
      type: 'DONOR_APPROVED',
      module: 'DONOR_REVIEW',
      title: 'Donor approved for active pool',
      description: 'Patience Adjei was approved for emergency donor matching.',
      entityType: 'DONOR_REVIEW',
      entityId: 'seed_review_4',
      donorId: donorById.seed_donor_5.id,
      hospitalId: hospitalById.seed_hospital_2.id,
    },
    {
      id: 'seed_activity_6',
      actorUserId: hospitalById.seed_hospital_2.user.id,
      actorName: hospitalById.seed_hospital_2.hospitalName,
      type: 'REQUEST_COMPLETED',
      module: 'REQUESTS',
      title: 'Scheduled request completed',
      description: 'AB+ scheduled request was closed after donation completion.',
      entityType: 'BLOOD_REQUEST',
      entityId: 'seed_request_5',
      hospitalId: hospitalById.seed_hospital_2.id,
      bloodRequestId: 'seed_request_5',
    },
  ];

  for (const activity of activitySeeds) {
    await prisma.activityLog.upsert({
      where: { id: activity.id },
      update: activity,
      create: activity,
    });
  }

  const securitySeeds = [
    {
      id: 'seed_security_1',
      actorUserId: admin.id,
      email: 'admin@hospital.org',
      eventType: 'LOGIN_SUCCESS',
      severity: SecurityEventSeverity.INFO,
      description: 'Admin console login succeeded.',
      ipAddress: '192.168.1.10',
      device: 'Admin Nursing Station',
    },
    {
      id: 'seed_security_2',
      actorUserId: null,
      email: 'unknown.user@example.com',
      eventType: 'FAILED_LOGIN',
      severity: SecurityEventSeverity.WARNING,
      description: 'Failed login attempt on admin route.',
      ipAddress: '192.168.1.55',
      device: 'Unknown Browser Session',
    },
    {
      id: 'seed_security_3',
      actorUserId: donorById.seed_donor_1.user.id,
      email: donorById.seed_donor_1.user.email,
      eventType: 'FAILED_ADMIN_ROUTE_ACCESS',
      severity: SecurityEventSeverity.CRITICAL,
      description: 'Donor attempted to access an admin-only route.',
      ipAddress: '10.0.0.34',
      device: 'Android Chrome Mobile',
    },
    {
      id: 'seed_security_4',
      actorUserId: hospitalById.seed_hospital_2.user.id,
      email: hospitalById.seed_hospital_2.user.email,
      eventType: 'LOGIN_SUCCESS',
      severity: SecurityEventSeverity.INFO,
      description: 'Hospital staff login succeeded.',
      ipAddress: '172.16.0.20',
      device: 'Tema Emergency Console',
    },
  ];

  for (const event of securitySeeds) {
    await prisma.securityEvent.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    });
  }

  const refreshTokenSeeds = [
    {
      id: 'seed_refresh_admin_1',
      userId: admin.id,
      tokenHash: 'seed-hash-admin-session-1',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    },
    {
      id: 'seed_refresh_hospital_1',
      userId: hospitalById.seed_hospital_2.user.id,
      tokenHash: 'seed-hash-hospital-session-1',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    },
  ];

  for (const token of refreshTokenSeeds) {
    await prisma.refreshToken.upsert({
      where: { id: token.id },
      update: token,
      create: token,
    });
  }

  const sessionLogSeeds = [
    {
      id: 'seed_session_super_admin_1',
      userId: superAdmin.id,
      refreshTokenId: null,
      ipAddress: '10.10.0.10',
      device: 'Secure Operations Workstation',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/136.0',
      createdAt: new Date(Date.now() - 90 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 4 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      loggedOutAt: null,
      isSuspicious: false,
    },
    {
      id: 'seed_session_admin_1',
      userId: admin.id,
      refreshTokenId: 'seed_refresh_admin_1',
      ipAddress: '192.168.1.10',
      device: 'Admin Nursing Station',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/136.0',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 9 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      loggedOutAt: null,
      isSuspicious: false,
    },
    {
      id: 'seed_session_hospital_admin_1',
      userId: hospitalById.seed_hospital_2.user.id,
      refreshTokenId: 'seed_refresh_hospital_1',
      ipAddress: '172.16.0.20',
      device: 'Tema Emergency Console',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/136.0',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 14 * 60 * 1000),
      expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      loggedOutAt: null,
      isSuspicious: false,
    },
    {
      id: 'seed_session_inventory_1',
      userId: staffUsersByEmail.get('inventory.officer@cityhospital.org')?.id ?? admin.id,
      refreshTokenId: null,
      ipAddress: '10.0.4.18',
      device: 'Blood Bank Inventory Tablet',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)',
      createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 27 * 60 * 1000),
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      loggedOutAt: new Date(Date.now() - 30 * 60 * 1000),
      isSuspicious: false,
    },
    {
      id: 'seed_session_suspicious_1',
      userId: admin.id,
      refreshTokenId: null,
      ipAddress: '203.0.113.45',
      device: 'Unknown Browser Session',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      loggedOutAt: null,
      isSuspicious: true,
    },
  ];

  for (const session of sessionLogSeeds) {
    await prisma.sessionLog.upsert({
      where: { id: session.id },
      update: session,
      create: session,
    });
  }

  const extraNotifications = [
    {
      id: 'seed_notification_admin_low_stock',
      userId: admin.id,
      bloodRequestId: null,
      type: NotificationType.INVENTORY_ALERT,
      title: 'Low stock warning for O-',
      body: 'O- inventory is below the safe threshold across partner hospitals.',
      channel: 'IN_APP',
      isRead: false,
      delivered: true,
    },
    {
      id: 'seed_notification_admin_review',
      userId: admin.id,
      bloodRequestId: null,
      type: NotificationType.SYSTEM,
      title: 'Pending donor clinical reviews',
      body: 'Three donor eligibility submissions need final approval.',
      channel: 'IN_APP',
      isRead: false,
      delivered: true,
    },
    {
      id: 'seed_notification_hospital_expiry',
      userId: hospitalById.seed_hospital_3.user.id,
      bloodRequestId: null,
      type: NotificationType.INVENTORY_ALERT,
      title: 'Expiry warning on B- stock',
      body: 'One B- unit is approaching expiry at Komfo Anokye Teaching Hospital.',
      channel: 'IN_APP',
      isRead: true,
      delivered: true,
    },
  ];

  for (const notification of extraNotifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: notification,
      create: notification,
    });
  }

  const auditSeeds = [
    {
      id: 'seed_audit_1',
      actorUserId: admin.id,
      action: 'SEED_INITIALIZED',
      module: 'SYSTEM',
      entityType: 'SYSTEM',
      entityId: 'seed-bootstrap',
      description: 'Initial command center seed completed.',
      ipAddress: '127.0.0.1',
      device: 'Local Seed Runner',
      metadata: { message: 'Initial seed completed' },
      oldValue: {},
      newValue: { status: 'seeded' },
    },
    {
      id: 'seed_audit_2',
      actorUserId: admin.id,
      action: 'DONOR_REVIEW_STATUS_UPDATED',
      module: 'DONOR_REVIEW',
      entityType: 'DONOR_REVIEW',
      entityId: 'seed_review_4',
      description: 'Admin approved donor eligibility review.',
      ipAddress: '192.168.1.10',
      device: 'Admin Nursing Station',
      metadata: { donorId: donorById.seed_donor_5.id },
      oldValue: { status: DonorReviewStatus.OFFICE_USE_COMPLETED },
      newValue: { status: DonorReviewStatus.APPROVED },
    },
    {
      id: 'seed_audit_3',
      actorUserId: hospitalById.seed_hospital_2.user.id,
      action: 'BLOOD_REQUEST_UPDATED',
      module: 'REQUESTS',
      entityType: 'BLOOD_REQUEST',
      entityId: 'seed_request_2',
      description: 'Tema General Hospital updated a critical O- request.',
      ipAddress: '172.16.0.20',
      device: 'Tema Emergency Console',
      metadata: { hospitalId: hospitalById.seed_hospital_2.id },
      oldValue: { trackingStatus: RequestProgressStatus.PENDING },
      newValue: { trackingStatus: RequestProgressStatus.PENDING, priority: PriorityLevel.CRITICAL },
    },
  ];

  for (const auditEntry of auditSeeds) {
    await prisma.auditLog.upsert({
      where: { id: auditEntry.id },
      update: auditEntry,
      create: auditEntry,
    });
  }

  await prisma.websiteAlert.upsert({
    where: { id: 'seed_website_alert' },
    update: {
      title: 'Urgent O- blood request',
      message: 'URGENT: O- blood needed at Tema General Hospital',
      bloodType: BloodGroup.O_NEG,
      hospitalName: 'Tema General Hospital',
      urgencyLevel: PriorityLevel.CRITICAL,
      isActive: true,
      isSticky: true,
      isScrolling: true,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
    create: {
      id: 'seed_website_alert',
      title: 'Urgent O- blood request',
      message: 'URGENT: O- blood needed at Tema General Hospital',
      bloodType: BloodGroup.O_NEG,
      hospitalName: 'Tema General Hospital',
      urgencyLevel: PriorityLevel.CRITICAL,
      isActive: true,
      isSticky: true,
      isScrolling: true,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  });

  const websiteStatistics = [
    {
      key: WebsiteStatisticKey.REGISTERED_DONORS,
      label: 'Registered Donors',
      description: 'Verified donor workflows connected to hospital response needs.',
      overrideValue: 12540,
      isOverrideEnabled: true,
    },
    {
      key: WebsiteStatisticKey.EMERGENCY_MATCHES,
      label: 'Emergency Matches',
      description: 'Urgent requests coordinated faster through structured matching.',
      overrideValue: 3210,
      isOverrideEnabled: true,
    },
    {
      key: WebsiteStatisticKey.PARTNER_HOSPITALS,
      label: 'Partner Hospitals',
      description: 'Hospitals and blood centers participating in the response network.',
      overrideValue: 25,
      isOverrideEnabled: true,
    },
    {
      key: WebsiteStatisticKey.REQUESTS_COMPLETED,
      label: 'Requests Completed',
      description: 'Tracked blood request workflows from creation to fulfillment.',
      overrideValue: 8420,
      isOverrideEnabled: true,
    },
  ];

  for (const statistic of websiteStatistics) {
    await prisma.websiteStatistic.upsert({
      where: { key: statistic.key },
      update: statistic,
      create: statistic,
    });
  }

  const faqs = [
    {
      id: 'seed_faq_1',
      question: 'Who can donate blood?',
      answer: 'Healthy adults who meet age, weight, and screening requirements can usually donate blood safely.',
      isPublished: true,
    },
    {
      id: 'seed_faq_2',
      question: 'How often can I donate?',
      answer: 'Whole blood donors are usually advised to wait several weeks between donations, depending on screening guidance.',
      isPublished: true,
    },
  ];

  for (const faq of faqs) {
    await prisma.faq.upsert({
      where: { id: faq.id },
      update: faq,
      create: faq,
    });
  }

  await prisma.testimonial.upsert({
    where: { id: 'seed_testimonial_1' },
    update: {
      name: 'Akosua Boateng',
      role: 'Repeat Donor',
      message: 'The platform made it simple to respond quickly when a nearby hospital needed my blood group.',
      location: 'Accra',
      isApproved: true,
      isPublished: true,
    },
    create: {
      id: 'seed_testimonial_1',
      name: 'Akosua Boateng',
      role: 'Repeat Donor',
      message: 'The platform made it simple to respond quickly when a nearby hospital needed my blood group.',
      location: 'Accra',
      isApproved: true,
      isPublished: true,
    },
  });

  await prisma.awarenessPost.upsert({
    where: { id: 'seed_awareness_1' },
    update: {
      title: 'Why blood donation matters',
      content: 'One donation can support multiple lifesaving care workflows when hospitals face urgent shortages.',
      image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=900&q=80',
      category: 'Awareness',
      isPublished: true,
    },
    create: {
      id: 'seed_awareness_1',
      title: 'Why blood donation matters',
      content: 'One donation can support multiple lifesaving care workflows when hospitals face urgent shortages.',
      image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=900&q=80',
      category: 'Awareness',
      isPublished: true,
    },
  });

  const partnerHospitalSeeds = [
    {
      id: 'seed_partner_hospital_1',
      hospitalName: 'Tema General Hospital',
      location: 'Tema, Greater Accra',
      phone: '+233544515775',
      email: 'tema.partner@bloodresponse.local',
      description: 'Partner emergency care center supporting urgent donor coordination.',
      latitude: 5.6698,
      longitude: -0.0166,
    },
    {
      id: 'seed_partner_hospital_2',
      hospitalName: 'Korle Bu Teaching Hospital Blood Bank',
      location: 'Korle Bu, Accra',
      phone: '+233554287342',
      email: 'korlebu.partner@bloodresponse.local',
      description: 'Major tertiary referral and blood bank center for Greater Accra emergency response.',
      latitude: 5.5363,
      longitude: -0.2275,
    },
    {
      id: 'seed_partner_hospital_3',
      hospitalName: 'Komfo Anokye Teaching Hospital',
      location: 'Bantama, Kumasi',
      phone: '+233544515775',
      email: 'kath.partner@bloodresponse.local',
      description: 'Teaching hospital partner supporting Ashanti region transfusion and donor workflows.',
      latitude: 6.693,
      longitude: -1.632,
    },
    {
      id: 'seed_partner_hospital_4',
      hospitalName: 'Ho Teaching Hospital',
      location: 'Ho, Volta Region',
      phone: '+233554287342',
      email: 'ho.partner@bloodresponse.local',
      description: 'Regional teaching hospital partner for Volta emergency donor coordination.',
      latitude: 6.6008,
      longitude: 0.4703,
    },
    {
      id: 'seed_partner_hospital_9',
      hospitalName: 'Ho Municipal Hospital',
      location: 'Ho, Volta Region',
      phone: '+233554287342',
      email: 'homunicipal.partner@bloodresponse.local',
      description: 'Municipal hospital donation center supporting Volta region emergency referrals.',
      latitude: 6.6111,
      longitude: 0.4708,
    },
    {
      id: 'seed_partner_hospital_5',
      hospitalName: 'Cape Coast Teaching Hospital',
      location: 'Cape Coast, Central Region',
      phone: '+233544515775',
      email: 'capecoast.partner@bloodresponse.local',
      description: 'Central region referral center for donor appointments and request fulfillment.',
      latitude: 5.1308,
      longitude: -1.2795,
    },
    {
      id: 'seed_partner_hospital_6',
      hospitalName: '37 Military Hospital',
      location: 'Accra, Greater Accra',
      phone: '+233554287342',
      email: '37military.partner@bloodresponse.local',
      description: 'Emergency-ready partner center supporting trauma and critical transfusion response.',
      latitude: 5.5887,
      longitude: -0.1851,
    },
    {
      id: 'seed_partner_hospital_7',
      hospitalName: 'Tamale Teaching Hospital',
      location: 'Tamale, Northern Region',
      phone: '+233544515775',
      email: 'tamale.partner@bloodresponse.local',
      description: 'Northern sector teaching hospital partner for regional donation and response coordination.',
      latitude: 9.4034,
      longitude: -0.8424,
    },
    {
      id: 'seed_partner_hospital_8',
      hospitalName: 'National Blood Service Ghana',
      location: 'Accra, Greater Accra',
      phone: '+233554287342',
      email: 'nbs.partner@bloodresponse.local',
      description: 'Demo national blood service listing for donation center discovery and public directions.',
      latitude: 5.558,
      longitude: -0.205,
    },
  ];

  for (const partnerHospital of partnerHospitalSeeds) {
    await prisma.partnerHospital.upsert({
      where: { id: partnerHospital.id },
      update: partnerHospital,
      create: partnerHospital,
    });
  }

  await prisma.websiteFooterSettings.upsert({
    where: { singletonKey: 'default' },
    update: {
      emergencyPhonePrimary: '+233544515775',
      emergencyPhoneSecondary: '+233554287342',
      supportEmail: 'support@bloodresponse.local',
      facebookUrl: 'https://facebook.com/donationdesk',
      instagramUrl: 'https://instagram.com/donationdesk',
      linkedinUrl: 'https://linkedin.com/company/donationdesk',
      footerText: 'Built for trusted donor coordination, hospital response, and emergency visibility.',
    },
    create: {
      singletonKey: 'default',
      emergencyPhonePrimary: '+233544515775',
      emergencyPhoneSecondary: '+233554287342',
      supportEmail: 'support@bloodresponse.local',
      facebookUrl: 'https://facebook.com/donationdesk',
      instagramUrl: 'https://instagram.com/donationdesk',
      linkedinUrl: 'https://linkedin.com/company/donationdesk',
      footerText: 'Built for trusted donor coordination, hospital response, and emergency visibility.',
    },
  });

  await prisma.websiteAnnouncement.upsert({
    where: { sourceKey: 'website-alert:seed_website_alert' },
    update: {
      sourceType: WebsiteAnnouncementType.ALERT,
      title: 'Urgent O- blood request',
      message: 'URGENT: O- blood needed at Tema General Hospital',
      href: '/emergency-requests',
      priority: PriorityLevel.CRITICAL,
      badge: 'Sticky + Scrolling',
      isPublished: true,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
    create: {
      sourceKey: 'website-alert:seed_website_alert',
      sourceType: WebsiteAnnouncementType.ALERT,
      title: 'Urgent O- blood request',
      message: 'URGENT: O- blood needed at Tema General Hospital',
      href: '/emergency-requests',
      priority: PriorityLevel.CRITICAL,
      badge: 'Sticky + Scrolling',
      isPublished: true,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  });

  await prisma.websiteAnnouncement.upsert({
    where: { sourceKey: 'awareness-post:seed_awareness_1' },
    update: {
      sourceType: WebsiteAnnouncementType.AWARENESS,
      title: 'Why blood donation matters',
      message: 'One donation can support multiple lifesaving care workflows when hospitals face urgent shortages.',
      href: '/about',
      priority: PriorityLevel.MEDIUM,
      badge: 'Awareness',
      isPublished: true,
      expiresAt: null,
    },
    create: {
      sourceKey: 'awareness-post:seed_awareness_1',
      sourceType: WebsiteAnnouncementType.AWARENESS,
      title: 'Why blood donation matters',
      message: 'One donation can support multiple lifesaving care workflows when hospitals face urgent shortages.',
      href: '/about',
      priority: PriorityLevel.MEDIUM,
      badge: 'Awareness',
      isPublished: true,
      expiresAt: null,
    },
  });

  await prisma.websiteAnnouncement.upsert({
    where: { sourceKey: 'system:support-channels' },
    update: {
      sourceType: WebsiteAnnouncementType.SYSTEM,
      title: 'Support channels are live',
      message: 'Emergency contacts and partner hospitals are monitored. Reach support at support@bloodresponse.local.',
      href: '/contact',
      priority: PriorityLevel.LOW,
      badge: 'System',
      isPublished: true,
      expiresAt: null,
    },
    create: {
      sourceKey: 'system:support-channels',
      sourceType: WebsiteAnnouncementType.SYSTEM,
      title: 'Support channels are live',
      message: 'Emergency contacts and partner hospitals are monitored. Reach support at support@bloodresponse.local.',
      href: '/contact',
      priority: PriorityLevel.LOW,
      badge: 'System',
      isPublished: true,
      expiresAt: null,
    },
  });

  const clinicalQuestions = [
    'Are you feeling well today, with no fever, cough, headache or cold?',
    'Have you ever been deferred as a blood donor or told not to donate blood?',
    'Are you taking any medication?',
    'Have you had or do you have epilepsy, stomach ulcer, heart disease or cancer?',
    'Have you had tuberculosis?',
    'Have you been vaccinated in the last 4 weeks?',
    'Have you had jaundice, liver disease or a positive blood test for hepatitis?',
    'Do you have sickle cell disease?',
    'Have you ever injected yourself with drugs or medication?',
    'In the last 6 months, have you had a needle-stick injury, injection outside a hospital/clinic, or tattoo/body piercing?',
    'Have you ever had a headache?',
    'Have you had dental treatment in the last 1 week or are you taking antibiotics now?',
    'Have you had surgery with general anaesthesia in the last 6 months?',
    'Have you received blood or blood component transfusion in the last 6 months?',
    'Have you lost more than 5kg in weight unintentionally in the last 6 months?',
    'Have you had unprotected sex with more than one partner or been paid/paid someone for sex in the last 6 months?',
    'Have you had gonorrhoea, genital or urinary pain/discharge?',
    'For men only: have you had sex with a man in the last 6 months?',
    'Have you or your partner ever tested positive for HIV/AIDS?',
    'After donation, are you going to take part in vigorous activity such as climbing, driving heavy vehicles, operating heavy machinery, or working at heights?',
    'Are you donating because you were told you have too much blood?',
    'Have you been pregnant in the last 12 months or are you currently breastfeeding?',
  ];

  const clinicalRecordSeeds = [
    {
      id: 'seed_clinical_draft',
      donorId: 'seed_donor_2',
      status: DonorClinicalStatus.DRAFT,
      firstName: 'Michael',
      lastName: 'Asare',
      email: 'donor2@example.com',
      phoneNumber: '+233200000003',
      selectedHospitalId: 'seed_hospital_2',
      dateOfBirth: new Date('1998-04-12'),
      sex: 'Male',
      donorRiskFlag: false,
      donorRiskSummary: null,
    },
    {
      id: 'seed_clinical_submitted',
      donorId: 'seed_donor_1',
      status: DonorClinicalStatus.SUBMITTED,
      firstName: 'Ama',
      lastName: 'Mensah',
      email: 'donor1@example.com',
      phoneNumber: '+233200000001',
      selectedHospitalId: 'seed_hospital_1',
      dateOfBirth: new Date('1996-08-02'),
      sex: 'Female',
      donorRiskFlag: true,
      donorRiskSummary: 'q6: recent vaccination requires review',
    },
    {
      id: 'seed_clinical_approved',
      donorId: 'seed_donor_3',
      status: DonorClinicalStatus.APPROVED,
      firstName: 'Daniel',
      lastName: 'Owusu',
      email: 'donor3@example.com',
      phoneNumber: '+233200000004',
      selectedHospitalId: 'seed_hospital_3',
      dateOfBirth: new Date('1992-01-20'),
      sex: 'Male',
      donorRiskFlag: false,
      donorRiskSummary: null,
    },
  ];

  for (const record of clinicalRecordSeeds) {
    await prisma.donorClinicalRecord.upsert({
      where: { id: record.id },
      update: {
        status: record.status,
        selectedHospitalId: record.selectedHospitalId,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phoneNumber: record.phoneNumber,
        dateOfBirth: record.dateOfBirth,
        sex: record.sex,
        donorRiskFlag: record.donorRiskFlag,
        donorRiskSummary: record.donorRiskSummary,
        declarationConfirmed: record.status !== DonorClinicalStatus.DRAFT,
        testingConsent: record.status !== DonorClinicalStatus.DRAFT,
        staffEligibilityConsent: record.status !== DonorClinicalStatus.DRAFT,
        dataUseConsent: record.status !== DonorClinicalStatus.DRAFT,
        isLocked: record.status !== DonorClinicalStatus.DRAFT,
        submittedAt: record.status !== DonorClinicalStatus.DRAFT ? new Date() : null,
      },
      create: {
        id: record.id,
        donorId: record.donorId,
        selectedHospitalId: record.selectedHospitalId,
        status: record.status,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phoneNumber: record.phoneNumber,
        dateOfBirth: record.dateOfBirth,
        sex: record.sex,
        areaOfResidence: 'Accra',
        preferredContactMethod: 'SMS',
        donorRiskFlag: record.donorRiskFlag,
        donorRiskSummary: record.donorRiskSummary,
        declarationConfirmed: record.status !== DonorClinicalStatus.DRAFT,
        testingConsent: record.status !== DonorClinicalStatus.DRAFT,
        staffEligibilityConsent: record.status !== DonorClinicalStatus.DRAFT,
        dataUseConsent: record.status !== DonorClinicalStatus.DRAFT,
        isLocked: record.status !== DonorClinicalStatus.DRAFT,
        submittedAt: record.status !== DonorClinicalStatus.DRAFT ? new Date() : null,
      },
    });
    await prisma.donorClinicalHealthAnswer.deleteMany({ where: { clinicalRecordId: record.id } });
    await prisma.donorClinicalHealthAnswer.createMany({
      data: clinicalQuestions.map((questionText, index) => ({
        clinicalRecordId: record.id,
        questionKey: `q${index + 1}`,
        questionText,
        answer: record.donorRiskFlag && index === 5,
        details: record.donorRiskFlag && index === 5 ? 'Received vaccination recently; needs clinical review.' : null,
        riskFlag: record.donorRiskFlag && index === 5,
      })),
    });
  }

  await prisma.donorClinicalReview.upsert({
    where: { clinicalRecordId: 'seed_clinical_approved' },
    update: { outcomeOfScreening: ClinicalScreeningOutcome.QUALIFIED, qualifiesToDonate: ClinicalYesNo.YES, nurseName: 'Nurse Adjoa Mensah', reviewedAt: new Date() },
    create: { clinicalRecordId: 'seed_clinical_approved', outcomeOfScreening: ClinicalScreeningOutcome.QUALIFIED, qualifiesToDonate: ClinicalYesNo.YES, nurseName: 'Nurse Adjoa Mensah', reviewedAt: new Date() },
  });

  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
