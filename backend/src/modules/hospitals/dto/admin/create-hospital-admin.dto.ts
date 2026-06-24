import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateHospitalAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, and special character',
  })
  password!: string;

  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Hospital name should contain letters only' })
  hospitalName!: string;

  @IsString()
  registrationCode!: string;

  @IsString()
  address!: string;

  @IsString()
  location!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
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
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Contact name should contain letters only' })
  contactName!: string;

  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Contact phone must be digits with country code' })
  contactPhone!: string;
}
