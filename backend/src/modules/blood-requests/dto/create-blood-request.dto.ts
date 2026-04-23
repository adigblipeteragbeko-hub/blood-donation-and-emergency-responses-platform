import { BloodGroup, PriorityLevel, RequestType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBloodRequestDto {
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

  @IsDateString()
  requiredBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
