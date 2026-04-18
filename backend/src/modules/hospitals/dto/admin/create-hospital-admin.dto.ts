import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

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
