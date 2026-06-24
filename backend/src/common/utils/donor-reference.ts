import { Prisma } from '@prisma/client';

type DonorReferenceClient = Pick<Prisma.TransactionClient, 'donor'>;

export async function generateDonorReference(client: DonorReferenceClient, sequenceOffset = 0) {
  const year = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
  const existingThisYear = await client.donor.count({
    where: {
      createdAt: { gte: yearStart, lt: nextYearStart },
    },
  });

  let sequence = existingThisYear + 1 + sequenceOffset;
  while (sequence < existingThisYear + 1000) {
    const candidate = `DON-${year}-${String(sequence).padStart(5, '0')}`;
    const existing = await client.donor.findUnique({
      where: { donorNumber: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    sequence += 1;
  }

  throw new Error('Unable to generate a unique donor reference.');
}
