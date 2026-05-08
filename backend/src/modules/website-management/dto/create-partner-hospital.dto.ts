import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class CreatePartnerHospitalDto {
  @IsString()
  @MaxLength(120)
  hospitalName!: string;

  @IsString()
  @MaxLength(120)
  location!: string;

  @IsPhoneNumber(undefined, { message: 'phone must be a valid international phone number' })
  phone!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
