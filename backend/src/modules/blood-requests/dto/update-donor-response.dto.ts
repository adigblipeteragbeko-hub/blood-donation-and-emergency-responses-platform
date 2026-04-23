import { DonorResponseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDonorResponseDto {
  @IsOptional()
  @IsEnum(DonorResponseStatus)
  responseStatus?: DonorResponseStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

