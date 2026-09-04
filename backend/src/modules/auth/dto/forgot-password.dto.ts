import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;
}
