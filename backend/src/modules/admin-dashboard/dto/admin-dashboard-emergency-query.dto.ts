import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import { BloodGroup, PriorityLevel } from '@prisma/client';

export class AdminDashboardEmergencyQueryDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodType?: BloodGroup;

  @IsOptional()
  @IsEnum(PriorityLevel)
  urgency?: PriorityLevel;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  take?: number;
}
