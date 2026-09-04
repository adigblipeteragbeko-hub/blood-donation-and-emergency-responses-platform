import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-normalization';

export class ResendVerificationDto {
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['EMAIL', 'SMS'])
  method?: 'EMAIL' | 'SMS';
}
