import { Role, StaffAccountStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHospitalStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, and special character',
  })
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsEnum(StaffAccountStatus)
  status?: StaffAccountStatus;

  @IsOptional()
  @IsBoolean()
  isDepartmentHead?: boolean;
}
