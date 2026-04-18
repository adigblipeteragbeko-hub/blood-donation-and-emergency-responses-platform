import { BloodGroup } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateDonorAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, and special character',
  })
  password!: string;

  @IsString()
  fullName!: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsString()
  location!: string;

  @IsBoolean()
  eligibilityStatus!: boolean;

  @IsBoolean()
  availabilityStatus!: boolean;

  @IsString()
  emergencyContactName!: string;

  @IsString()
  emergencyContactPhone!: string;

  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;
}
