import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['EMAIL', 'SMS'])
  method?: 'EMAIL' | 'SMS';
}
