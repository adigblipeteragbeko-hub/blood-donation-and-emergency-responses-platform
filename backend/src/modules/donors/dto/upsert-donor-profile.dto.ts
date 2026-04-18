import { BloodGroup } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class UpsertDonorProfileDto {
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Full name should contain letters only' })
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
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Emergency contact name should contain letters only' })
  emergencyContactName!: string;

  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Emergency contact phone must be digits with country code' })
  emergencyContactPhone!: string;

  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;
}
