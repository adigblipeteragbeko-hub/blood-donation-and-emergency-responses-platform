import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDonorLocationDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
