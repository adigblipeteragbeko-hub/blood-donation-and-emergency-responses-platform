import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

function buildUser(overrides: Partial<any> = {}) {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '',
    role: Role.DONOR,
    isActive: true,
    emailVerified: true,
    profileImageUrl: null,
    profileImageUpdatedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildService(user: any | null) {
  const state = { user };
  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        const expectedEmail = where.email?.equals;
        if (!state.user || expectedEmail !== state.user.email.toLowerCase()) return null;
        return state.user;
      }),
      update: jest.fn(async ({ data }: any) => {
        state.user = { ...state.user, ...data };
        return state.user;
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'refresh-token-1',
        ...data,
      })),
    },
    sessionLog: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'session-1' })),
    },
    passwordResetToken: {
      create: jest.fn(async () => ({ id: 'reset-token-1' })),
    },
  };
  const jwtService = {
    signAsync: jest
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token'),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        'jwt.refreshTtlDays': 7,
        'security.loginFailedAttemptThreshold': 5,
        'security.loginLockoutMinutes': 15,
        'security.resetTokenTtlMinutes': 30,
      };
      return values[key] ?? fallback;
    }),
  };
  const auditService = { log: jest.fn() };
  const alertsService = { notifySecurity: jest.fn(), notifyCritical: jest.fn() };
  const mailService = {
    sendEmail: jest.fn(async () => ({ accepted: ['test@example.com'], rejected: [] })),
  };
  const activityService = { log: jest.fn() };
  const securityEvents = { log: jest.fn() };
  const geocoding = {};
  const realtime = {};
  const smsService = {};

  const service = new AuthService(
    prisma as any,
    jwtService as any,
    config as any,
    auditService as any,
    alertsService as any,
    mailService as any,
    activityService as any,
    securityEvents as any,
    geocoding as any,
    realtime as any,
    smsService as any,
  );

  return { service, prisma, jwtService, config, auditService, alertsService, mailService, securityEvents, state };
}

describe('AuthService authentication security', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs in with a lowercase email and valid Argon2 password', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!') });
    const { service } = buildService(user);

    const result = await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.accessToken).toBe('access-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('logs in with a mixed-case email', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!') });
    const { service, prisma } = buildService(user);

    await service.login({ email: 'TEST@example.COM', password: 'Password123!' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'test@example.com', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('logs in with surrounding spaces around the email', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!') });
    const { service, prisma } = buildService(user);

    await service.login({ email: '  Test@Example.COM  ', password: 'Password123!' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'test@example.com', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('rejects a wrong password generically and increments the failed counter', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!') });
    const { service, prisma } = buildService(user);

    await expect(service.login({ email: 'test@example.com', password: 'Wrong123!' })).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginCount: 1, lockedUntil: null },
    });
  });

  it('rejects an unknown account generically', async () => {
    const { service } = buildService(null);

    await expect(service.login({ email: 'missing@example.com', password: 'Password123!' })).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('resets failed login counters after a successful login', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!'), failedLoginCount: 3 });
    const { service, prisma } = buildService(user);

    await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  });

  it('activates lockout at the failed login threshold', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!'), failedLoginCount: 4 });
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T00:00:00.000Z'));
    const { service, prisma, alertsService } = buildService(user);

    await expect(service.login({ email: 'test@example.com', password: 'Wrong123!' })).rejects.toThrow(
      'Invalid email or password',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginCount: 5, lockedUntil: new Date('2026-08-31T00:15:00.000Z') },
    });
    expect(alertsService.notifySecurity).toHaveBeenCalledWith('FAILED_LOGIN_THRESHOLD', {
      userId: 'user-1',
      email: 'test@example.com',
    });
  });

  it('rejects login while an account is locked', async () => {
    const user = buildUser({
      passwordHash: await argon2.hash('Password123!'),
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const { service, jwtService } = buildService(user);

    await expect(service.login({ email: 'test@example.com', password: 'Password123!' })).rejects.toThrow(
      'Invalid email or password',
    );

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('allows login after lockout expiry and clears the lock', async () => {
    const user = buildUser({
      passwordHash: await argon2.hash('Password123!'),
      failedLoginCount: 5,
      lockedUntil: new Date(Date.now() - 60_000),
    });
    const { service, prisma } = buildService(user);

    await service.login({ email: 'test@example.com', password: 'Password123!' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  });

  it('does not issue tokens for an inactive account', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!'), isActive: false });
    const { service, jwtService } = buildService(user);

    await expect(service.login({ email: 'test@example.com', password: 'Password123!' })).rejects.toThrow(
      'Invalid email or password',
    );

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('does not include resetTokenPreview in forgot-password responses', async () => {
    const user = buildUser({ passwordHash: await argon2.hash('Password123!') });
    const { service, mailService } = buildService(user);

    await expect(service.forgotPassword({ email: ' Test@Example.COM ' })).resolves.toEqual({
      message: 'If account exists, reset instructions were sent',
    });
    expect(mailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'BloodSOS Password Reset',
      }),
    );
  });
});
