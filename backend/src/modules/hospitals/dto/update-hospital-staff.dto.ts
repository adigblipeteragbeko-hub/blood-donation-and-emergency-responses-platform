import { Role, StaffAccountStatus } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHospitalStaffDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsEnum(StaffAccountStatus)
  status?: StaffAccountStatus;

  @IsOptional()
  @IsBoolean()
  isDepartmentHead?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
