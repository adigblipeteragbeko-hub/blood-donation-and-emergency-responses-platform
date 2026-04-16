import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateHospitalAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  hospitalName!: string;

  @IsString()
  registrationCode!: string;

  @IsString()
  address!: string;

  @IsString()
  location!: string;

  @IsString()
  contactName!: string;

  @IsString()
  contactPhone!: string;
}
