import { BloodGroup, StockWarningLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MobilizeDonorsDto {
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsOptional()
  @IsEnum(StockWarningLevel)
  warningLevel?: StockWarningLevel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(24)
  @Max(168)
  forecastPeriodHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  radiusKm?: number;
}
