import { BloodGroup, PriorityLevel, RequestType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBloodRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  hospitalCenterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  patientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  patientCode?: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsInt()
  @Min(1)
  unitsNeeded!: number;

  @IsEnum(RequestType)
  type!: RequestType;

  @IsEnum(PriorityLevel)
  priority!: PriorityLevel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationNotes?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsDateString()
  requiredBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
