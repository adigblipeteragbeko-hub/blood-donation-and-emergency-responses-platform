import { describe, expect, it } from '@jest/globals';
import { AppointmentStatus, Role } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

const makeService = () => {
  const countCalls: any[] = [];
  const findManyCalls: any[] = [];
  const prisma = {
    appointment: {
      count: async (args: any) => {
        countCalls.push(args);
        return 5;
      },
      findMany: async (args: any) => {
        findManyCalls.push(args);
        return [];
      },
    },
  };
  const hospitalAccess = {
    getHospitalForUser: async () => ({ id: 'hospital-1' }),
  };
  const service = new AppointmentsService(
    prisma as any,
    {} as any,
    hospitalAccess as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, countCalls, findManyCalls };
};

describe('Hospital appointments today summary', () => {
  it('uses scheduledAt local-day filtering instead of createdAt or completedAt', async () => {
    const { service, countCalls } = makeService();

    await service.summaryForUser('hospital-user-1', Role.HOSPITAL_ADMIN, {
      dateFilter: 'today',
      localDate: '2026-07-23',
      timezoneOffsetMinutes: 0,
    });

    const where = countCalls[0].where;
    expect(where.hospitalId).toBe('hospital-1');
    expect(where.scheduledAt.gte.toISOString()).toBe('2026-07-23T00:00:00.000Z');
    expect(where.scheduledAt.lt.toISOString()).toBe('2026-07-24T00:00:00.000Z');
    expect(where.createdAt).toBeUndefined();
    expect(where.completedAt).toBeUndefined();
  });

  it('uses the same today query for the dashboard summary and appointments list', async () => {
    const { service, countCalls, findManyCalls } = makeService();
    const query = {
      dateFilter: 'today' as const,
      localDate: '2026-07-23',
      timezoneOffsetMinutes: 0,
      skip: 0,
      take: 25,
    };

    await service.summaryForUser('hospital-user-1', Role.HOSPITAL_ADMIN, query);
    await service.listForUser('hospital-user-1', Role.HOSPITAL_ADMIN, query);

    const summaryWhere = countCalls[0].where;
    const listWhere = findManyCalls[0].where;
    expect(listWhere).toEqual(summaryWhere);
  });

  it('intentionally includes pending, confirmed, completed, declined, and cancelled scheduled today', async () => {
    const { service, countCalls } = makeService();

    await service.summaryForUser('hospital-user-1', Role.HOSPITAL_ADMIN, {
      dateFilter: 'today',
      localDate: '2026-07-23',
      timezoneOffsetMinutes: 0,
    });

    const statuses = countCalls[0].where.status.in;
    expect(statuses).toEqual(expect.arrayContaining([
      AppointmentStatus.PENDING_CONFIRMATION,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.DECLINED,
      AppointmentStatus.CANCELLED,
    ]));
  });

  it('uses the browser timezone offset when building the local calendar day window', async () => {
    const { service, countCalls } = makeService();

    await service.summaryForUser('hospital-user-1', Role.HOSPITAL_ADMIN, {
      dateFilter: 'today',
      localDate: '2026-07-23',
      timezoneOffsetMinutes: 240,
    });

    const where = countCalls[0].where;
    expect(where.scheduledAt.gte.toISOString()).toBe('2026-07-23T04:00:00.000Z');
    expect(where.scheduledAt.lt.toISOString()).toBe('2026-07-24T04:00:00.000Z');
  });
});
