import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { BloodGroup } from '@prisma/client';

export class OperationalDonorQueryDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;
}
