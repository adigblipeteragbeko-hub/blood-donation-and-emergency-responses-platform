import 'dotenv/config';
import {
  BloodGroup,
  ClinicalPassFail,
  ClinicalScreeningOutcome,
  ClinicalYesNo,
  DonorClinicalStatus,
  DonorProfileVisibility,
  DonorReviewStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { generateDonorReference } from '../src/common/utils/donor-reference';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo123!';

const demoDonors: Array<{
  email: string;
  bloodGroup: Exclude<BloodGroup, 'UNKNOWN'>;
  firstName: string;
  surname: string;
  phone: string;
  location: string;
  areaCommunity: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
}> = [
  {
    email: 'demo.a.pos@example.test',
    bloodGroup: BloodGroup.A_POS,
    firstName: 'Ama',
    surname: 'Apositive',
    phone: '+233590000001',
    location: 'Tema Community 1',
    areaCommunity: 'Community 1',
    city: 'Tema',
    region: 'Greater Accra',
    latitude: 5.5902,
    longitude: -0.1471,
  },
  {
    email: 'demo.a.neg@example.test',
    bloodGroup: BloodGroup.A_NEG,
    firstName: 'Akosua',
    surname: 'Anegative',
    phone: '+233590000002',
    location: 'Tema Community 2',
    areaCommunity: 'Community 2',
    city: 'Tema',
    region: 'Greater Accra',
    latitude: 5.5857,
    longitude: -0.1564,
  },
  {
    email: 'demo.b.pos@example.test',
    bloodGroup: BloodGroup.B_POS,
    firstName: 'Kofi',
    surname: 'Bpositive',
    phone: '+233590000003',
    location: 'Spintex',
    areaCommunity: 'Spintex',
    city: 'Accra',
    region: 'Greater Accra',
    latitude: 5.6048,
    longitude: -0.1452,
  },
  {
    email: 'demo.b.neg@example.test',
    bloodGroup: BloodGroup.B_NEG,
    firstName: 'Kojo',
    surname: 'Bnegative',
    phone: '+233590000004',
    location: 'Teshie',
    areaCommunity: 'Teshie',
    city: 'Accra',
    region: 'Greater Accra',
    latitude: 5.5874,
    longitude: -0.1472,
  },
  {
    email: 'demo.ab.pos@example.test',
    bloodGroup: BloodGroup.AB_POS,
    firstName: 'Esi',
    surname: 'Abpositive',
    phone: '+233590000005',
    location: 'Nungua',
    areaCommunity: 'Nungua',
    city: 'Accra',
    region: 'Greater Accra',
    latitude: 5.6011,
    longitude: -0.1578,
  },
  {
    email: 'demo.ab.neg@example.test',
    bloodGroup: BloodGroup.AB_NEG,
    firstName: 'Yaw',
    surname: 'Abnegative',
    phone: '+233590000006',
    location: 'Sakumono',
    areaCommunity: 'Sakumono',
    city: 'Tema',
    region: 'Greater Accra',
    latitude: 5.5967,
    longitude: -0.1397,
  },
  {
    email: 'demo.o.pos@example.test',
    bloodGroup: BloodGroup.O_POS,
    firstName: 'Kwame',
    surname: 'Opositive',
    phone: '+233590000007',
    location: 'Ashaiman',
    areaCommunity: 'Ashaiman',
    city: 'Tema',
    region: 'Greater Accra',
    latitude: 5.5821,
    longitude: -0.1634,
  },
  {
    email: 'demo.o.neg@example.test',
    bloodGroup: BloodGroup.O_NEG,
    firstName: 'Afia',
    surname: 'Onegative',
    phone: '+233590000008',
    location: 'Tema New Town',
    areaCommunity: 'Tema New Town',
    city: 'Tema',
    region: 'Greater Accra',
    latitude: 5.5736,
    longitude: -0.1739,
  },
];

async function findPreferredHospital() {
  return prisma.hospital.findFirst({
    where: {
      isApproved: true,
      bloodBankAvailable: true,
    },
    orderBy: { hospitalName: 'asc' },
    select: { id: true, hospitalName: true, location: true },
  });
}

async function upsertApprovedClinicalRecord(donor: {
  id: string;
  userId: string;
  donorNumber: string | null;
  firstName: string | null;
  otherNames: string | null;
  surname: string | null;
  fullName: string;
  phone: string | null;
  bloodGroup: BloodGroup;
  location: string;
  areaCommunity: string | null;
  city: string | null;
  region: string | null;
  dateOfBirth: Date | null;
}, preferredHospitalId?: string) {
  const now = new Date();
  const existing = await prisma.donorClinicalRecord.findFirst({
    where: { donorId: donor.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const clinicalPayload = {
    selectedHospitalId: preferredHospitalId ?? null,
    status: DonorClinicalStatus.APPROVED,
    isLocked: true,
    submittedAt: now,
    hospitalReviewedAt: now,
    officeCompletedAt: now,
    finalDecisionAt: now,
    formDate: now,
    venue: preferredHospitalId ? 'Preferred demo screening hospital' : 'Demo screening venue',
    title: 'Mx',
    firstName: donor.firstName,
    otherNames: donor.otherNames,
    lastName: donor.surname,
    dateOfBirth: donor.dateOfBirth,
    sex: 'Demo',
    areaOfResidence: donor.areaCommunity ?? donor.location,
    addressOrWorkplace: donor.location,
    occupation: 'Demo donor',
    idType: 'Demo ID',
    idNumber: `DEMO-${donor.donorNumber ?? donor.id}`,
    phoneNumber: donor.phone,
    email: undefined,
    donorType: 'VOLUNTARY',
    hasDonatedBefore: false,
    lastDonationDate: null,
    numberOfVoluntaryDonations: 0,
    numberOfReplacementDonations: 0,
    donorCardNumber: donor.donorNumber,
    declarationConfirmed: true,
    testingConsent: true,
    contactConsent: true,
    staffEligibilityConsent: true,
    dataUseConsent: true,
    declarationDate: now,
    donorRiskFlag: false,
    donorRiskSummary: null,
    reviewNotes: 'Demo donor approved for emergency alert workflow testing.',
  };

  const clinicalRecord = existing
    ? await prisma.donorClinicalRecord.update({
        where: { id: existing.id },
        data: clinicalPayload,
      })
    : await prisma.donorClinicalRecord.create({
        data: {
          donorId: donor.id,
          ...clinicalPayload,
        },
      });

  await prisma.donorClinicalReview.upsert({
    where: { clinicalRecordId: clinicalRecord.id },
    update: {
      appearancePassed: ClinicalPassFail.PASSED,
      medicalHistoryPassed: ClinicalPassFail.PASSED,
      weightKg: 70,
      bloodPressure: '120/80',
      pulseBpm: 72,
      haemoglobinLevel: 13.5,
      hbByCuSO4Passed: ClinicalPassFail.PASSED,
      hbSagChecked: ClinicalYesNo.YES,
      hbSagResult: 'Negative',
      qualifiesToDonate: ClinicalYesNo.YES,
      outcomeOfScreening: ClinicalScreeningOutcome.QUALIFIED,
      temporaryDeferralReasons: [],
      permanentDeferralReasons: [],
      temporaryDeferralDuration: null,
      comments: 'Demo donor screening approved.',
      nurseName: 'Demo Nurse',
      reviewedAt: now,
    },
    create: {
      clinicalRecordId: clinicalRecord.id,
      appearancePassed: ClinicalPassFail.PASSED,
      medicalHistoryPassed: ClinicalPassFail.PASSED,
      weightKg: 70,
      bloodPressure: '120/80',
      pulseBpm: 72,
      haemoglobinLevel: 13.5,
      hbByCuSO4Passed: ClinicalPassFail.PASSED,
      hbSagChecked: ClinicalYesNo.YES,
      hbSagResult: 'Negative',
      qualifiesToDonate: ClinicalYesNo.YES,
      outcomeOfScreening: ClinicalScreeningOutcome.QUALIFIED,
      temporaryDeferralReasons: [],
      permanentDeferralReasons: [],
      comments: 'Demo donor screening approved.',
      nurseName: 'Demo Nurse',
      reviewedAt: now,
    },
  });

  const existingReview = await prisma.donorEligibilityReview.findFirst({
    where: { donorId: donor.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existingReview) {
    await prisma.donorEligibilityReview.update({
      where: { id: existingReview.id },
      data: {
        selectedHospitalId: preferredHospitalId ?? null,
        status: DonorReviewStatus.APPROVED,
        reviewNotes: 'Demo donor approved for emergency alert workflow testing.',
        officeUseNotes: 'Demo office-use screening completed.',
        clinicalRiskFlag: false,
        clinicalRiskNotes: null,
        hospitalReviewedAt: now,
        officeCompletedAt: now,
        approvedAt: now,
        rejectedAt: null,
      },
    });
  } else {
    await prisma.donorEligibilityReview.create({
      data: {
        donorId: donor.id,
        selectedHospitalId: preferredHospitalId ?? null,
        status: DonorReviewStatus.APPROVED,
        reviewNotes: 'Demo donor approved for emergency alert workflow testing.',
        officeUseNotes: 'Demo office-use screening completed.',
        clinicalRiskFlag: false,
        submittedAt: now,
        hospitalReviewedAt: now,
        officeCompletedAt: now,
        approvedAt: now,
      },
    });
  }
}

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const preferredHospital = await findPreferredHospital();

  for (const demo of demoDonors) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        passwordHash,
        role: Role.DONOR,
        emailVerified: true,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        email: demo.email,
        passwordHash,
        role: Role.DONOR,
        emailVerified: true,
        isActive: true,
      },
    });

    const existingDonor = await prisma.donor.findUnique({
      where: { userId: user.id },
      select: { donorNumber: true },
    });
    const donorNumber = existingDonor?.donorNumber ?? (await generateDonorReference(prisma));
    const fullName = `${demo.surname} ${demo.firstName}`;

    const donor = await prisma.donor.upsert({
      where: { userId: user.id },
      update: {
        donorNumber,
        fullName,
        firstName: demo.firstName,
        otherNames: 'Demo',
        surname: demo.surname,
        phone: demo.phone,
        alternativePhoneNumber: null,
        dateOfBirth: new Date('1995-01-15T00:00:00.000Z'),
        bloodGroup: demo.bloodGroup,
        location: demo.location,
        postalAddress: 'Demo donor address',
        signature: null,
        passportPhotoUrl: null,
        dateIssued: new Date(),
        latitude: demo.latitude,
        longitude: demo.longitude,
        areaCommunity: demo.areaCommunity,
        city: demo.city,
        region: demo.region,
        preferredHospitalId: preferredHospital?.id ?? null,
        lastLocationUpdateAt: new Date(),
        locationSharingEnabled: true,
        eligibilityStatus: true,
        availabilityStatus: true,
        lastDonationDate: null,
        nextEligibilityDate: null,
        emergencyContactName: 'Demo Emergency Contact',
        emergencyContactPhone: '+233590009999',
        emergencyContactRelationship: 'Test contact',
        notificationEmailEnabled: true,
        notificationSmsEnabled: false,
        profileVisibility: DonorProfileVisibility.PRIVATE,
      },
      create: {
        userId: user.id,
        donorNumber,
        fullName,
        firstName: demo.firstName,
        otherNames: 'Demo',
        surname: demo.surname,
        phone: demo.phone,
        alternativePhoneNumber: null,
        dateOfBirth: new Date('1995-01-15T00:00:00.000Z'),
        bloodGroup: demo.bloodGroup,
        location: demo.location,
        postalAddress: 'Demo donor address',
        dateIssued: new Date(),
        latitude: demo.latitude,
        longitude: demo.longitude,
        areaCommunity: demo.areaCommunity,
        city: demo.city,
        region: demo.region,
        preferredHospitalId: preferredHospital?.id ?? null,
        lastLocationUpdateAt: new Date(),
        locationSharingEnabled: true,
        eligibilityStatus: true,
        availabilityStatus: true,
        lastDonationDate: null,
        nextEligibilityDate: null,
        emergencyContactName: 'Demo Emergency Contact',
        emergencyContactPhone: '+233590009999',
        emergencyContactRelationship: 'Test contact',
        notificationEmailEnabled: true,
        notificationSmsEnabled: false,
        profileVisibility: DonorProfileVisibility.PRIVATE,
      },
    });

    await upsertApprovedClinicalRecord(donor, preferredHospital?.id);
  }

  const verification = await prisma.donor.groupBy({
    by: ['bloodGroup'],
    where: {
      user: { email: { in: demoDonors.map((demo) => demo.email) } },
      eligibilityStatus: true,
      availabilityStatus: true,
      locationSharingEnabled: true,
      lastDonationDate: null,
      nextEligibilityDate: null,
      clinicalRecords: {
        some: { status: DonorClinicalStatus.APPROVED },
        none: {
          status: {
            in: [
              DonorClinicalStatus.REJECTED,
              DonorClinicalStatus.TEMPORARILY_DEFERRED,
              DonorClinicalStatus.PERMANENTLY_DEFERRED,
            ],
          },
        },
      },
    },
    _count: { _all: true },
  });

  console.table(
    verification.map((item) => ({
      bloodGroup: item.bloodGroup,
      approvedAvailableDemoDonors: item._count._all,
    })),
  );
  console.log(`Demo donor seed complete. Password for all demo donor accounts: ${DEMO_PASSWORD}`);
  console.log(
    preferredHospital
      ? `Preferred hospital linked: ${preferredHospital.hospitalName} (${preferredHospital.location})`
      : 'No approved blood-bank hospital was found, so preferredHospitalId was left empty.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
