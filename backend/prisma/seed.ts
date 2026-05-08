import 'dotenv/config';
import {
  PrismaClient,
  Role,
  BloodGroup,
  RequestType,
  PriorityLevel,
  RequestProgressStatus,
  RequestStatus,
  DonorResponseStatus,
  InventoryChangeType,
  AppointmentStatus,
  NotificationType,
  WebsiteStatisticKey,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await argon2.hash('AdminPass123!');
  const donorPassword = await argon2.hash('DonorPass123!');
  const hospitalPassword = await argon2.hash('HospitalPass123!');

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

  const donorUser = await prisma.user.upsert({
    where: { email: 'donor1@example.com' },
    update: {
      passwordHash: donorPassword,
      role: Role.DONOR,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'donor1@example.com',
      passwordHash: donorPassword,
      role: Role.DONOR,
      emailVerified: true,
    },
  });

  const hospitalUser = await prisma.user.upsert({
    where: { email: 'cityhospital@example.com' },
    update: {
      passwordHash: hospitalPassword,
      role: Role.HOSPITAL_STAFF,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'cityhospital@example.com',
      passwordHash: hospitalPassword,
      role: Role.HOSPITAL_STAFF,
      emailVerified: true,
    },
  });

  const donor = await prisma.donor.upsert({
    where: { userId: donorUser.id },
    update: {
      latitude: 5.6037,
      longitude: -0.187,
    },
    create: {
      userId: donorUser.id,
      fullName: 'Ama Mensah',
      bloodGroup: BloodGroup.O_POS,
      location: 'Accra',
      latitude: 5.6037,
      longitude: -0.187,
      eligibilityStatus: true,
      availabilityStatus: true,
      emergencyContactName: 'Kojo Mensah',
      emergencyContactPhone: '+233200000001',
    },
  });

  const hospital = await prisma.hospital.upsert({
    where: { userId: hospitalUser.id },
    update: {
      latitude: 5.614818,
      longitude: -0.205874,
    },
    create: {
      userId: hospitalUser.id,
      hospitalName: 'City Hospital',
      registrationCode: 'CH-001',
      address: '12 Health Avenue',
      location: 'Accra',
      latitude: 5.614818,
      longitude: -0.205874,
      contactName: 'Dr. Evans',
      contactPhone: '+233200000002',
    },
  });

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
        requiredBy: new Date(Date.now() + 3 * 60 * 60 * 1000),
        notes: 'Road traffic emergency case.',
        matchedDonors: { connect: [{ id: donor.id }] },
      },
    }));

  await prisma.bloodRequest.update({
    where: { id: bloodRequest.id },
    data: { matchedDonors: { connect: [{ id: donor.id }] } },
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

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'SEED_INITIALIZED',
      entityType: 'SYSTEM',
      metadata: { message: 'Initial seed completed' },
    },
  });

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

  await prisma.partnerHospital.upsert({
    where: { id: 'seed_partner_hospital_1' },
    update: {
      hospitalName: 'Tema General Hospital',
      location: 'Tema',
      phone: '+233544515775',
      email: 'tema.partner@bloodresponse.local',
      description: 'Partner emergency care center supporting urgent donor coordination.',
      latitude: 5.6698,
      longitude: -0.0166,
    },
    create: {
      id: 'seed_partner_hospital_1',
      hospitalName: 'Tema General Hospital',
      location: 'Tema',
      phone: '+233544515775',
      email: 'tema.partner@bloodresponse.local',
      description: 'Partner emergency care center supporting urgent donor coordination.',
      latitude: 5.6698,
      longitude: -0.0166,
    },
  });

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
