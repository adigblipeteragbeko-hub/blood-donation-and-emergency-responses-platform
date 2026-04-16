import { BloodGroup } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertDonorProfileDto {
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
