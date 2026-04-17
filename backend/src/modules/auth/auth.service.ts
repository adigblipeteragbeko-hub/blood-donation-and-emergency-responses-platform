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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly alertsService: AlertsService,
    private readonly mailService: MailService,
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    if (payload.role === 'DONOR' && !payload.donorProfile) {
      throw new BadRequestException('Donor profile details are required');
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
        await tx.donor.create({
          data: {
            userId: createdUser.id,
            fullName: payload.donorProfile.fullName,
            bloodGroup: payload.donorProfile.bloodGroup,
            location: payload.donorProfile.location,
            eligibilityStatus: true,
            availabilityStatus: true,
            emergencyContactName: payload.donorProfile.emergencyContactName,
            emergencyContactPhone: payload.donorProfile.emergencyContactPhone,
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

    return {
      message: 'Registration successful. A verification code has been sent to your email.',
      requiresEmailVerification: true,
      email: user.email,
    };
  }

  async login(payload: LoginDto) {
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
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.log('LOGIN', 'USER', user.id, user.id);

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

  async logout(userId: string, refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log('LOGOUT', 'USER', userId, userId);
    return { message: 'Logged out successfully' };
  }

  async refresh(userId: string, refreshToken: string, role: Role) {
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
    await this.storeRefreshToken(userId, tokens.refreshToken);

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

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
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
