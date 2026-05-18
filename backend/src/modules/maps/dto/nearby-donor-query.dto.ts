import { BloodGroup } from '@prisma/client';
import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NearbyDonorQueryDto {
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number = 25;
}
