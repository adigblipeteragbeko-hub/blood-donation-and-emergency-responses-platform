import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { RegisterDonorProfileDto } from './register-donor-profile.dto';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['DONOR', 'HOSPITAL_STAFF'])
  role!: 'DONOR' | 'HOSPITAL_STAFF';

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDonorProfileDto)
  donorProfile?: RegisterDonorProfileDto;
}
