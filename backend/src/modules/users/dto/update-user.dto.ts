import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
