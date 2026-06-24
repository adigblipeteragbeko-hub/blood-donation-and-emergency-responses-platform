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

export class UpsertDonorProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Full name should contain letters only' })
  fullName?: string;

  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'First name should contain letters only' })
  firstName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Other names should contain letters only' })
  otherNames?: string;

  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Surname should contain letters only' })
  surname!: string;

  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Primary phone number must be digits with country code' })
  phone!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Alternative phone number must be digits with country code' })
  alternativePhoneNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsString()
  location!: string;

  @IsOptional()
  @IsString()
  postalAddress?: string;

  @IsOptional()
  @IsString()
  preferredHospitalId?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  passportPhotoUrl?: string;

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

  @IsString()
  @IsIn(emergencyContactRelationships)
  emergencyContactRelationship!: string;

  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;
}
