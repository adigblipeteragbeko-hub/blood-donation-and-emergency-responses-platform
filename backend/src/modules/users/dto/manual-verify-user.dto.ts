import { ManualVerificationMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class ManualVerifyUserDto {
  @IsEnum(ManualVerificationMethod)
  method!: ManualVerificationMethod;

  @IsString()
  @MinLength(10)
  reason!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
