import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class UpdatePartnerHospitalDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hospitalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'phone must be a valid international phone number' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number | null;
}
