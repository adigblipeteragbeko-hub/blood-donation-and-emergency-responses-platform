import { BloodGroup } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';

const emergencyContactRelationships = [
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Spouse',
  'Guardian',
  'Friend',
  'Relative',
  'Other',
] as const;

export class UpdateDonorAdminDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'First name should contain letters only' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Other names should contain letters only' })
  otherNames?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Surname should contain letters only' })
  surname?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Primary phone number must be digits with country code' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Alternative phone number must be digits with country code' })
  alternativePhoneNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  postalAddress?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  passportPhotoUrl?: string;

  @IsOptional()
  @IsDateString()
  dateIssued?: string;

  @IsOptional()
  @IsBoolean()
  eligibilityStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  availabilityStatus?: boolean;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  @IsIn(emergencyContactRelationships)
  emergencyContactRelationship?: string;

  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;
}
