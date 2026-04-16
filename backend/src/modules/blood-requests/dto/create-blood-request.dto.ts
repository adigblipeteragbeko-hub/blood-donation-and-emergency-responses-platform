import { BloodGroup, PriorityLevel, RequestType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBloodRequestDto {
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
  location!: string;

  @IsDateString()
  requiredBy!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
