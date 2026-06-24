import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { MailService } from '../../common/mail/mail.service';
import { ActivityService } from '../../common/activity/activity.service';
import { SecurityEventsService } from '../../common/security/security-events.service';
import { GeocodingService } from '../../common/maps/geocoding.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { generateDonorReference } from '../../common/utils/donor-reference';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

type SafeUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly alertsService: AlertsService,
    private readonly mailService: MailService,
    private readonly activityService: ActivityService,
    private readonly securityEvents: SecurityEventsService,
    private readonly geocoding: GeocodingService,
    private readonly realtime: RealtimeService,
  ) {}

  private async buildHospitalRegistrationCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `HOS-${Date.now().toString().slice(-8)}-${randomInt(100, 999)}`;
      const exists = await this.prisma.hospital.findUnique({
        where: { registrationCode: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }

    return `HOS-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private buildDonorDisplayName(profile: {
    firstName?: string;
    otherNames?: string;
    surname?: string;
    fullName?: string;
  }) {
    return [profile.surname, profile.firstName, profile.otherNames]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || profile.fullName?.trim() || 'Unnamed Donor';
  }

  async register(payload: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    if (payload.role === 'DONOR' && !payload.donorProfile) {
      throw new BadRequestException('Donor profile details are required');
    }
    if (payload.role === 'HOSPITAL_STAFF' && !payload.hospitalProfile) {
      throw new BadRequestException('Hospital profile details are required');
    }

    if (payload.role === 'DONOR' && payload.donorProfile?.preferredHospitalId) {
      const preferredHospital = await this.prisma.hospital.findFirst({
        where: {
          id: payload.donorProfile.preferredHospitalId,
          isApproved: true,
          bloodBankAvailable: true,
        },
        select: { id: true },
      });
      if (!preferredHospital) {
        throw new BadRequestException('Selected hospital/blood bank is not available for screening.');
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: payload.email,
          passwordHash: await argon2.hash(payload.password),
          role: payload.role as Role,
          emailVerified: false,
        },
      });

      if (payload.role === 'DONOR' && payload.donorProfile) {
        const preferredHospitalId = payload.donorProfile.preferredHospitalId?.trim();
        const fullName = this.buildDonorDisplayName(payload.donorProfile);
        await tx.donor.create({
          data: {
            userId: createdUser.id,
            donorNumber: await generateDonorReference(tx),
            fullName,
            firstName: payload.donorProfile.firstName?.trim(),
            otherNames: payload.donorProfile.otherNames?.trim() || null,
            surname: payload.donorProfile.surname?.trim(),
            phone: payload.donorProfile.phone,
            alternativePhoneNumber: payload.donorProfile.alternativePhoneNumber,
            dateOfBirth: payload.donorProfile.dateOfBirth ? new Date(payload.donorProfile.dateOfBirth) : undefined,
            bloodGroup: payload.donorProfile.bloodGroup,
            location: payload.donorProfile.location?.trim() || 'Pending clinical eligibility form',
            preferredHospitalId: preferredHospitalId || undefined,
            postalAddress: payload.donorProfile.postalAddress,
            signature: payload.donorProfile.signature,
            passportPhotoUrl: payload.donorProfile.passportPhotoUrl,
            dateIssued: new Date(),
            eligibilityStatus: false,
            availabilityStatus: false,
            emergencyContactName: payload.donorProfile.emergencyContactName,
            emergencyContactPhone: payload.donorProfile.emergencyContactPhone,
            emergencyContactRelationship: payload.donorProfile.emergencyContactRelationship,
          },
        });
      }

      if (payload.role === 'HOSPITAL_STAFF' && payload.hospitalProfile) {
        if (!payload.hospitalProfile.city?.trim() || !payload.hospitalProfile.region?.trim()) {
          throw new BadRequestException('City and region are required for hospital emergency map coordination.');
        }
        const registrationCode = await this.buildHospitalRegistrationCode();
        const geocoded =
          typeof payload.hospitalProfile.latitude === 'number' && typeof payload.hospitalProfile.longitude === 'number'
            ? null
            : await this.geocoding.geocodeHospitalAddress({
                hospitalName: payload.hospitalProfile.hospitalName,
                address: payload.hospitalProfile.address,
                city: payload.hospitalProfile.city,
                region: payload.hospitalProfile.region,
                location: payload.hospitalProfile.location,
              });
        const resolvedLatitude = payload.hospitalProfile.latitude ?? geocoded?.latitude ?? null;
        const resolvedLongitude = payload.hospitalProfile.longitude ?? geocoded?.longitude ?? null;
        if (resolvedLatitude === null || resolvedLongitude === null) {
          throw new BadRequestException(
            'Unable to locate this hospital automatically. Please enter latitude and longitude manually.',
          );
        }
        await tx.hospital.create({
          data: {
            userId: createdUser.id,
            hospitalName: payload.hospitalProfile.hospitalName,
            registrationCode,
            address: payload.hospitalProfile.address,
            location: payload.hospitalProfile.location?.trim() || payload.hospitalProfile.address,
            city: payload.hospitalProfile.city.trim(),
            region: payload.hospitalProfile.region.trim(),
            latitude: resolvedLatitude,
            longitude: resolvedLongitude,
            bloodBankAvailable: payload.hospitalProfile.bloodBankAvailable ?? true,
            contactName: payload.hospitalProfile.contactName,
            contactPhone: payload.hospitalProfile.contactPhone,
            isApproved: false,
          },
        });
      }

      return createdUser;
    });

    void this.createAndSendVerificationCode(user.id, user.email).catch(() => {
      this.alertsService.notifyCritical('EMAIL_DELIVERY_FAILED', {
        userId: user.id,
        email: user.email,
      });
    });
    await this.auditService.log('REGISTER', 'USER', user.id, user.id);
    if (payload.role === 'DONOR') {
      await this.activityService.log({
        actorUserId: user.id,
        actorName: payload.donorProfile?.fullName ?? payload.email,
        type: 'DONOR_REGISTERED',
        module: 'AUTH',
        title: 'New donor registered',
        description: `${payload.email} created a donor account and is waiting for verification.`,
        entityType: 'USER',
        entityId: user.id,
      });
    } else {
      await this.activityService.log({
        actorUserId: user.id,
        actorName: payload.hospitalProfile?.hospitalName ?? payload.email,
        type: 'HOSPITAL_REGISTERED',
        module: 'AUTH',
        title: 'New hospital registered',
        description: `${payload.email} registered a hospital/blood bank profile for onboarding.`,
        entityType: 'USER',
        entityId: user.id,
      });
      this.realtime.broadcastHospitalMapUpdate({
        reason: 'hospital.registered',
        email: payload.email,
        hospitalName: payload.hospitalProfile?.hospitalName ?? null,
      });
    }

    return {
      message: 'Registration successful. A verification code has been sent to your email.',
      requiresEmailVerification: true,
      email: user.email,
    };
  }

  async login(payload: LoginDto, metadata?: RequestMetadata) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, payload.password);
    if (!isValid) {
      const failedLoginCount = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount },
      });

      await this.securityEvents.log({
        actorUserId: user.id,
        email: user.email,
        eventType: 'FAILED_LOGIN',
        severity: failedLoginCount >= 5 ? 'WARNING' : 'INFO',
        description: `Failed login attempt for ${user.email}.`,
        ipAddress: metadata?.ipAddress ?? null,
        device: this.buildDeviceLabel(metadata?.userAgent),
        userAgent: metadata?.userAgent ?? null,
      });

      if (failedLoginCount >= 5) {
        this.alertsService.notifySecurity('FAILED_LOGIN_THRESHOLD', {
          userId: user.id,
          email: user.email,
        });
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== Role.ADMIN && !user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before login');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0 },
    });

    const tokens = await this.generateTokens(user.id, user.role);
    const refreshTokenRecord = await this.storeRefreshToken(user.id, tokens.refreshToken);
    const suspicious = await this.isSuspiciousSession(user.id, metadata);
    await this.prisma.sessionLog.create({
      data: {
        userId: user.id,
        refreshTokenId: refreshTokenRecord.id,
        ipAddress: metadata?.ipAddress ?? undefined,
        device: this.buildDeviceLabel(metadata?.userAgent),
        userAgent: metadata?.userAgent ?? undefined,
        expiresAt: refreshTokenRecord.expiresAt,
        lastSeenAt: new Date(),
        isSuspicious: suspicious,
      },
    });

    await this.auditService.log('LOGIN', 'USER', user.id, user.id);
    await this.securityEvents.log({
      actorUserId: user.id,
      email: user.email,
      eventType: 'LOGIN_SUCCESS',
      severity: suspicious ? 'WARNING' : 'INFO',
      description: `${user.email} logged in successfully.`,
      ipAddress: metadata?.ipAddress ?? null,
      device: this.buildDeviceLabel(metadata?.userAgent),
      userAgent: metadata?.userAgent ?? null,
      metadata: suspicious ? { suspicious: true } : undefined,
    });
    await this.activityService.log({
      actorUserId: user.id,
      actorName: user.email,
      type: 'USER_LOGIN',
      module: 'AUTH',
      title: 'User login',
      description: `${user.email} signed in.`,
      entityType: 'USER',
      entityId: user.id,
    });

    return { user: this.toSafeUser(user), ...tokens };
  }

  async verifyEmail(payload: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw new BadRequestException('Invalid verification request');
    }

    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    const codeHash = createHash('sha256').update(payload.code).digest('hex');
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.codeHash !== codeHash) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
    ]);

    await this.auditService.log('EMAIL_VERIFIED', 'USER', user.id, user.id);

    return { message: 'Email verified successfully. You can now login.' };
  }

  async resendVerificationCode(payload: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || user.emailVerified) {
      return { message: 'If verification is pending, a new code has been sent.' };
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.createAndSendVerificationCode(user.id, user.email);

    await this.auditService.log('EMAIL_VERIFICATION_CODE_RESENT', 'USER', user.id, user.id);

    return { message: 'If verification is pending, a new code has been sent.' };
  }

  async logout(userId: string, refreshToken: string, metadata?: RequestMetadata) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { userId, tokenHash, revokedAt: null },
      select: { id: true },
    });
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (existingToken) {
      await this.prisma.sessionLog.updateMany({
        where: {
          userId,
          refreshTokenId: existingToken.id,
          loggedOutAt: null,
        },
        data: {
          loggedOutAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }
    await this.auditService.log('LOGOUT', 'USER', userId, userId);
    await this.securityEvents.log({
      actorUserId: userId,
      eventType: 'LOGOUT',
      severity: 'INFO',
      description: revoked.count > 0 ? 'User logged out successfully.' : 'Logout attempted without active session.',
      ipAddress: metadata?.ipAddress ?? null,
      device: this.buildDeviceLabel(metadata?.userAgent),
      userAgent: metadata?.userAgent ?? null,
    });
    return { message: 'Logged out successfully' };
  }

  async refresh(userId: string, refreshToken: string, role: Role, metadata?: RequestMetadata) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(userId, role);
    const replacementToken = await this.storeRefreshToken(userId, tokens.refreshToken);
    await this.prisma.sessionLog.updateMany({
      where: {
        userId,
        refreshTokenId: storedToken.id,
        loggedOutAt: null,
      },
      data: {
        loggedOutAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
    await this.prisma.sessionLog.create({
      data: {
        userId,
        refreshTokenId: replacementToken.id,
        ipAddress: metadata?.ipAddress ?? undefined,
        device: this.buildDeviceLabel(metadata?.userAgent),
        userAgent: metadata?.userAgent ?? undefined,
        expiresAt: replacementToken.expiresAt,
        lastSeenAt: new Date(),
      },
    });

    return tokens;
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      return { message: 'If account exists, reset instructions were sent' };
    }

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    const ttlMinutes = this.config.get<number>('security.resetTokenTtlMinutes', 30);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.auditService.log('PASSWORD_RESET_REQUESTED', 'USER', user.id, user.id);

    return {
      message: 'If account exists, reset instructions were sent',
      // In production replace this with email/SMS dispatch only.
      resetTokenPreview: plainToken,
    };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(payload.token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const passwordHash = await argon2.hash(payload.newPassword);
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log('PASSWORD_RESET_COMPLETED', 'USER', resetToken.userId, resetToken.userId);

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, payload: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await argon2.verify(user.passwordHash, payload.oldPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(payload.newPassword) },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log('PASSWORD_CHANGED', 'USER', userId, userId);

    return { message: 'Password changed successfully' };
  }

  private async generateTokens(userId: string, role: Role) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, role },
      {
        secret: this.config.get<string>('jwt.accessSecret', 'replace-me'),
        expiresIn: this.config.get<string>('jwt.accessTtl', '15m'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, role },
      {
        secret: this.config.get<string>('jwt.refreshSecret', 'replace-me'),
        expiresIn: `${this.config.get<number>('jwt.refreshTtlDays', 7)}d`,
      },
    );

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.get<number>('jwt.refreshTtlDays', 7) * 86_400_000);

    return this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  private buildDeviceLabel(userAgent?: string | null) {
    if (!userAgent) {
      return 'Unknown device';
    }

    if (/iphone|ipad|ios/i.test(userAgent)) {
      return 'iOS device';
    }

    if (/android/i.test(userAgent)) {
      return 'Android device';
    }

    if (/windows/i.test(userAgent)) {
      return 'Windows device';
    }

    if (/macintosh|mac os/i.test(userAgent)) {
      return 'Mac device';
    }

    return 'Web device';
  }

  private async isSuspiciousSession(userId: string, metadata?: RequestMetadata) {
    if (!metadata?.ipAddress && !metadata?.userAgent) {
      return false;
    }

    const previousSessions = await this.prisma.sessionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { ipAddress: true, device: true },
    });

    if (previousSessions.length === 0) {
      return false;
    }

    const device = this.buildDeviceLabel(metadata.userAgent);

    return !previousSessions.some(
      (session) =>
        session.ipAddress === (metadata.ipAddress ?? null) &&
        session.device === device,
    );
  }

  private generateVerificationCode() {
    return `${randomInt(0, 1_000_000)}`.padStart(6, '0');
  }

  private async createAndSendVerificationCode(userId: string, email: string) {
    const code = this.generateVerificationCode();
    const codeHash = createHash('sha256').update(code).digest('hex');
    const ttlMinutes = this.config.get<number>('security.emailVerificationTtlMinutes', 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { userId, codeHash, expiresAt },
    });

    try {
      await this.mailService.sendEmail({
        to: email,
        subject: 'Verify your Blood Response account',
        text: `Your verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${ttlMinutes} minutes.</p>`,
      });
    } catch (error) {
      this.alertsService.notifyCritical('EMAIL_DELIVERY_FAILED', {
        userId,
        email,
      });
    }
  }

  toSafeUser(user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    emailVerified: boolean;
    failedLoginCount: number;
    lockedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
