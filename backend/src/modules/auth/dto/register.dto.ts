import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';
import { RegisterDonorProfileDto } from './register-donor-profile.dto';
import { RegisterHospitalProfileDto } from './register-hospital-profile.dto';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['DONOR', 'HOSPITAL_ADMIN'])
  role!: 'DONOR' | 'HOSPITAL_ADMIN';

  @IsOptional()
  @IsIn(['EMAIL', 'SMS'])
  verificationMethod?: 'EMAIL' | 'SMS';

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDonorProfileDto)
  donorProfile?: RegisterDonorProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterHospitalProfileDto)
  hospitalProfile?: RegisterHospitalProfileDto;
}
