import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type SafeUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
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
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash: await argon2.hash(payload.password),
        role: payload.role as Role,
      },
    });

    await this.auditService.log('REGISTER', 'USER', user.id, user.id);

    const tokens = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: this.toSafeUser(user), ...tokens };
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0 },
    });

    const tokens = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.log('LOGIN', 'USER', user.id, user.id);

    return { user: this.toSafeUser(user), ...tokens };
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

  toSafeUser(user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
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
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
