import { BloodGroup } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class RegisterDonorProfileDto {
  @IsString()
  fullName!: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsString()
  location!: string;

  @IsString()
  emergencyContactName!: string;

  @IsString()
  emergencyContactPhone!: string;
}

