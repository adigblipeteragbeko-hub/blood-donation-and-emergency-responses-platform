import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
