import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('emergency notification expiry wiring', () => {
  it('stores emergency notification expiry metadata on blood requests', () => {
    const schema = read('prisma/schema.prisma');
    const dto = read('src/modules/blood-requests/dto/create-blood-request.dto.ts');

    expect(schema).toContain('enum EmergencyNotificationStatus');
    expect(schema).toContain('emergencyNotificationStatus EmergencyNotificationStatus?');
    expect(schema).toContain('emergencyNotificationExpiresAt DateTime?');
    expect(schema).toContain('emergencyNotificationDurationMinutes Int?');
    expect(dto).toContain('emergencyNotificationDurationMinutes?: number');
    expect(dto).toContain('@Max(24 * 60)');
  });

  it('expires stale active emergency notifications before banner feeds are returned', () => {
    const service = read('src/modules/blood-requests/blood-requests.service.ts');

    expect(service).toContain('expireEmergencyNotifications(now)');
    expect(service).toContain('emergencyNotificationStatus: EmergencyNotificationStatus.ACTIVE');
    expect(service).toContain('emergencyNotificationExpiresAt: { gt: now }');
    expect(service).toContain('emergencyNotificationExpiresAt: { lte: now }');
    expect(service).toContain('emergencyNotificationStatus: EmergencyNotificationStatus.EXPIRED');
  });

  it('lets authorized hospital users resolve live emergency notifications', () => {
    const controller = read('src/modules/blood-requests/blood-requests.controller.ts');
    const service = read('src/modules/blood-requests/blood-requests.service.ts');

    expect(controller).toContain("@Patch(':id/emergency-notification/resolve')");
    expect(controller).toContain('Role.HOSPITAL_ADMIN, Role.ADMIN');
    expect(service).toContain('resolveEmergencyNotification');
    expect(service).toContain('EMERGENCY_NOTIFICATION_RESOLVED');
    expect(service).toContain('emergencyNotificationStatus: EmergencyNotificationStatus.RESOLVED');
  });
});
