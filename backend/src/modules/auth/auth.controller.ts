import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationCode(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(
    @CurrentUser()
    user: { id: string; role: Role; refreshToken: string },
    @Req() req: Request,
  ) {
    return this.authService.refresh(user.id, user.refreshToken, user.role, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAccessGuard)
  @Post('logout')
  logout(
    @CurrentUser() user: { id: string },
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ) {
    return this.authService.logout(user.id, refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAccessGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: { id: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @UseGuards(JwtAccessGuard)
  @Post('me')
  me(@Req() req: Request & { user?: Record<string, unknown> }) {
    if (!req.user) {
      return null;
    }

    const {
      id,
      email,
      role,
      isActive,
      emailVerified,
      failedLoginCount,
      lockedUntil,
      createdAt,
      updatedAt,
    } = req.user;

    return { id, email, role, isActive, emailVerified, failedLoginCount, lockedUntil, createdAt, updatedAt };
  }
}
