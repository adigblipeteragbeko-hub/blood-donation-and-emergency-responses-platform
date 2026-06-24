import { Type } from 'class-transformer';
import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class UpdateHospitalAdminDto {
  @IsOptional()
  @IsString()
  hospitalName?: string;

  @IsOptional()
  @IsString()
  registrationCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  bloodBankAvailable?: boolean;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
