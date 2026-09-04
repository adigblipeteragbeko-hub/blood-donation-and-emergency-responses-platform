import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
