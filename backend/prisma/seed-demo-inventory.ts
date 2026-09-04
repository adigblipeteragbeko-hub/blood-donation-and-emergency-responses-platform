import 'dotenv/config';
import { BloodGroup, InventoryChangeType, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_HOSPITAL_NAMES = [
  'Accra General Hospital',
  'Elias Hospital',
  'HO TEACHING',
  'Tema General Hospital',
] as const;

const TARGET_BLOOD_GROUPS = [
  BloodGroup.A_POS,
  BloodGroup.A_NEG,
  BloodGroup.B_POS,
  BloodGroup.B_NEG,
  BloodGroup.AB_POS,
  BloodGroup.AB_NEG,
  BloodGroup.O_POS,
  BloodGroup.O_NEG,
] as const;

const TARGET_AVAILABLE_UNITS = 20;
const DEMO_REASON = 'Final defense demo inventory preparation';

const bloodGroupLabels: Record<(typeof TARGET_BLOOD_GROUPS)[number], string> = {
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
  O_POS: 'O+',
  O_NEG: 'O-',
};

async function main() {
  const hospitals = await prisma.hospital.findMany({
    where: {
      OR: TARGET_HOSPITAL_NAMES.map((hospitalName) => ({
        hospitalName: { equals: hospitalName, mode: 'insensitive' as const },
      })),
    },
    select: {
      id: true,
      hospitalName: true,
    },
    orderBy: { hospitalName: 'asc' },
  });

  const matchedByName = new Map(hospitals.map((hospital) => [hospital.hospitalName.toLowerCase(), hospital]));
  const missing = TARGET_HOSPITAL_NAMES.filter((name) => !matchedByName.has(name.toLowerCase()));
  const duplicateNames = TARGET_HOSPITAL_NAMES.filter((name) => (
    hospitals.filter((hospital) => hospital.hospitalName.toLowerCase() === name.toLowerCase()).length > 1
  ));

  if (missing.length || duplicateNames.length || hospitals.length !== TARGET_HOSPITAL_NAMES.length) {
    throw new Error(
      [
        missing.length ? `Missing hospitals: ${missing.join(', ')}` : null,
        duplicateNames.length ? `Duplicate target hospitals: ${duplicateNames.join(', ')}` : null,
        `Matched ${hospitals.length} of ${TARGET_HOSPITAL_NAMES.length} target hospitals.`,
      ].filter(Boolean).join(' '),
    );
  }

  const actor = await prisma.user.findFirst({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const actorUserId = actor?.id ?? null;

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const hospitalName of TARGET_HOSPITAL_NAMES) {
      const hospital = matchedByName.get(hospitalName.toLowerCase())!;

      for (const bloodGroup of TARGET_BLOOD_GROUPS) {
        const existing = await tx.inventoryItem.findUnique({
          where: {
            hospitalId_bloodGroup: {
              hospitalId: hospital.id,
              bloodGroup,
            },
          },
        });
        const previousUnits = existing?.availableUnits ?? 0;
        const wasExpiring = existing?.expiringUnits ?? 0;
        const changeType = existing ? InventoryChangeType.ADJUSTED : InventoryChangeType.ADDED;

        const item = await tx.inventoryItem.upsert({
          where: {
            hospitalId_bloodGroup: {
              hospitalId: hospital.id,
              bloodGroup,
            },
          },
          update: {
            availableUnits: TARGET_AVAILABLE_UNITS,
            expiringUnits: 0,
            updatedById: actorUserId,
          },
          create: {
            hospitalId: hospital.id,
            bloodGroup,
            availableUnits: TARGET_AVAILABLE_UNITS,
            expiringUnits: 0,
            updatedById: actorUserId,
          },
        });

        if (!existing) created += 1;
        else if (previousUnits !== TARGET_AVAILABLE_UNITS || wasExpiring !== 0) updated += 1;
        else unchanged += 1;

        await tx.inventoryLog.create({
          data: {
            inventoryId: item.id,
            changeType,
            unitsChanged: TARGET_AVAILABLE_UNITS - previousUnits,
            previousUnits,
            newUnits: TARGET_AVAILABLE_UNITS,
            reason: DEMO_REASON,
            changedById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'DEMO_INVENTORY_PREPARED',
            entityType: 'INVENTORY',
            entityId: item.id,
            actorUserId,
            module: 'INVENTORY',
            description: `${DEMO_REASON}: ${hospital.hospitalName} ${bloodGroupLabels[bloodGroup]} set to ${TARGET_AVAILABLE_UNITS} available units.`,
            metadata: {
              hospitalId: hospital.id,
              hospitalName: hospital.hospitalName,
              bloodGroup,
              bloodGroupLabel: bloodGroupLabels[bloodGroup],
              previousUnits,
              newUnits: TARGET_AVAILABLE_UNITS,
              previousExpiringUnits: wasExpiring,
              newExpiringUnits: 0,
              reason: DEMO_REASON,
            },
          },
        });
      }
    }

    return { created, updated, unchanged };
  });

  const inventory = await prisma.inventoryItem.findMany({
    where: {
      hospitalId: { in: hospitals.map((hospital) => hospital.id) },
      bloodGroup: { in: [...TARGET_BLOOD_GROUPS] },
    },
    select: {
      bloodGroup: true,
      availableUnits: true,
      hospital: { select: { hospitalName: true } },
    },
    orderBy: [{ hospital: { hospitalName: 'asc' } }, { bloodGroup: 'asc' }],
  });

  console.log(`Demo inventory ready. Created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}.`);
  console.log(`Inventory logs created: ${TARGET_HOSPITAL_NAMES.length * TARGET_BLOOD_GROUPS.length}.`);
  console.log('Hospital | A+ | A- | B+ | B- | AB+ | AB- | O+ | O-');
  for (const hospitalName of TARGET_HOSPITAL_NAMES) {
    const values = TARGET_BLOOD_GROUPS.map((bloodGroup) => (
      inventory.find((item) => item.hospital.hospitalName === hospitalName && item.bloodGroup === bloodGroup)?.availableUnits ?? 0
    ));
    console.log(`${hospitalName} | ${values.join(' | ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
