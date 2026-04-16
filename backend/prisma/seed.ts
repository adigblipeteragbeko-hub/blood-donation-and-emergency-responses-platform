import 'dotenv/config';
import { PrismaClient, Role, BloodGroup, RequestType, PriorityLevel } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await argon2.hash('AdminPass123!');
  const donorPassword = await argon2.hash('DonorPass123!');
  const hospitalPassword = await argon2.hash('HospitalPass123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hospital.org' },
    update: {},
    create: {
      email: 'admin@hospital.org',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const donorUser = await prisma.user.upsert({
    where: { email: 'donor1@example.com' },
    update: {},
    create: {
      email: 'donor1@example.com',
      passwordHash: donorPassword,
      role: Role.DONOR,
    },
  });

  const hospitalUser = await prisma.user.upsert({
    where: { email: 'cityhospital@example.com' },
    update: {},
    create: {
      email: 'cityhospital@example.com',
      passwordHash: hospitalPassword,
      role: Role.HOSPITAL_STAFF,
    },
  });

  const donor = await prisma.donor.upsert({
    where: { userId: donorUser.id },
    update: {},
    create: {
      userId: donorUser.id,
      fullName: 'Ama Mensah',
      bloodGroup: BloodGroup.O_POS,
      location: 'Accra',
      eligibilityStatus: true,
      availabilityStatus: true,
      emergencyContactName: 'Kojo Mensah',
      emergencyContactPhone: '+233200000001',
    },
  });

  const hospital = await prisma.hospital.upsert({
    where: { userId: hospitalUser.id },
    update: {},
    create: {
      userId: hospitalUser.id,
      hospitalName: 'City Hospital',
      registrationCode: 'CH-001',
      address: '12 Health Avenue',
      location: 'Accra',
      contactName: 'Dr. Evans',
      contactPhone: '+233200000002',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { hospitalId_bloodGroup: { hospitalId: hospital.id, bloodGroup: BloodGroup.O_POS } },
    update: { availableUnits: 12 },
    create: {
      hospitalId: hospital.id,
      bloodGroup: BloodGroup.O_POS,
      availableUnits: 12,
    },
  });

  await prisma.bloodRequest.create({
    data: {
      hospitalId: hospital.id,
      bloodGroup: BloodGroup.O_POS,
      unitsNeeded: 4,
      type: RequestType.EMERGENCY,
      priority: PriorityLevel.CRITICAL,
      location: 'Accra',
      requiredBy: new Date(Date.now() + 3 * 60 * 60 * 1000),
      notes: 'Road traffic emergency case.',
      matchedDonors: { connect: [{ id: donor.id }] },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'SEED_INITIALIZED',
      entityType: 'SYSTEM',
      metadata: { message: 'Initial seed completed' },
    },
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
