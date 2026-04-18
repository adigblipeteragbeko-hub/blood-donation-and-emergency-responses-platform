import { BloodGroup } from '@prisma/client';
import { IsEnum, IsString, Matches } from 'class-validator';

export class RegisterDonorProfileDto {
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Full name should contain letters only' })
  fullName!: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsString()
  location!: string;

  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Emergency contact name should contain letters only' })
  emergencyContactName!: string;

  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Emergency contact phone must be digits with country code' })
  emergencyContactPhone!: string;
}
