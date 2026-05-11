import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DonorReviewStatus } from '@prisma/client';

export class UpdateDonorReviewDto {
  @IsEnum(DonorReviewStatus)
  status!: DonorReviewStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  officeUseNotes?: string;
}
