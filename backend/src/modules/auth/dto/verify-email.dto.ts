import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';

export class VerifyEmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
