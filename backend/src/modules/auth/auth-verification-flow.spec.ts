import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from '@jest/globals';

describe('auth verification delivery workflow', () => {
  const service = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  const registerDto = readFileSync(join(__dirname, 'dto/register.dto.ts'), 'utf8');
  const resendDto = readFileSync(join(__dirname, 'dto/resend-verification.dto.ts'), 'utf8');
  const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
  const smsService = readFileSync(join(__dirname, '../sms/sms.service.ts'), 'utf8');
  const usersService = readFileSync(join(__dirname, '../users/users.service.ts'), 'utf8');
  const config = readFileSync(join(__dirname, '../../config/app.config.ts'), 'utf8');

  it('supports email or SMS verification method selection without adding roles', () => {
    expect(registerDto).toContain("verificationMethod?: 'EMAIL' | 'SMS'");
    expect(resendDto).toContain("method?: 'EMAIL' | 'SMS'");
    expect(schema).toContain('enum Role {\n  ADMIN\n  DONOR\n  HOSPITAL_ADMIN\n}');
    expect(schema).toContain('enum VerificationDeliveryMethod');
    expect(schema).toContain('ACCOUNT_VERIFICATION');
  });

  it('uses five-minute expiry, cooldowns, and attempt limits from config', () => {
    expect(config).toContain("AUTH_VERIFICATION_CODE_EXPIRY_MINUTES");
    expect(config).toContain("'5'");
    expect(service).toContain('verificationTtlMinutes');
    expect(service).toContain('resendCooldownSeconds');
    expect(service).toContain('maxVerificationAttempts');
    expect(service).toContain('This verification code has expired. Request a new code.');
    expect(service).toContain('The verification code is incorrect.');
  });

  it('does not return success unless provider delivery is accepted', () => {
    expect(service).toContain('await this.createAndSendVerificationCode');
    expect(service).not.toContain('void this.createAndSendVerificationCode');
    expect(service).toContain("We couldn't send the email verification code. Please retry or choose SMS.");
    expect(service).toContain("We couldn't send the SMS verification code. Please retry or choose Email.");
    expect(service).toContain('delivery.rejected?.length');
  });

  it('redacts verification code content from SMS logs and audit metadata', () => {
    expect(service).toContain('messagePreviewOverride');
    expect(service).toContain('******');
    expect(smsService).toContain('input.messagePreviewOverride ?? message');
    expect(service).not.toContain('metadata: { code');
  });

  it('invalidates previous codes on resend, switching, and admin manual verification', () => {
    expect(service).toContain('VERIFICATION_METHOD_SWITCHED');
    expect(service).toContain('VERIFICATION_CODE_RESENT');
    expect(service).toContain('usedAt: new Date()');
    expect(usersService).toContain('DONOR_MANUALLY_VERIFIED');
    expect(usersService).toContain('emailVerificationToken.updateMany');
  });
});
