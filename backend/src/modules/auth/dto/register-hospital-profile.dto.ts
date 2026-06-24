import { Type } from 'class-transformer';
import { IsBoolean, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterHospitalProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  hospitalName!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  region!: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  bloodBankAvailable?: boolean;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  contactPhone!: string;
}
