import { Transform } from 'class-transformer';
import { BloodGroup } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { normalizeEmail } from '../../../../common/utils/email-normalization';

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

export class CreateDonorAdminDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, and special character',
  })
  password!: string;

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
  signature?: string;

  @IsOptional()
  @IsString()
  passportPhotoUrl?: string;

  @IsOptional()
  @IsDateString()
  dateIssued?: string;

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
