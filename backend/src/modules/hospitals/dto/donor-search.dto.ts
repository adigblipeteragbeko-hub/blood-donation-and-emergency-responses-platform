import { BloodGroup } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DonorSearchDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsIn(['EXACT', 'COMPATIBLE'])
  matchMode?: 'EXACT' | 'COMPATIBLE' = 'EXACT';

  @IsOptional()
  @IsIn(['AVAILABLE_ONLY', 'INCLUDE_COOLDOWN', 'INCLUDE_DEFERRED', 'ALL_APPROVED'])
  availabilityFilter?: 'AVAILABLE_ONLY' | 'INCLUDE_COOLDOWN' | 'INCLUDE_DEFERRED' | 'ALL_APPROVED' = 'AVAILABLE_ONLY';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  emergencyMode?: boolean;
}
