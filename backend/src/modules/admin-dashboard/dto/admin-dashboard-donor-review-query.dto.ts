import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import { DonorReviewStatus } from '@prisma/client';

export class AdminDashboardDonorReviewQueryDto {
  @IsOptional()
  @IsEnum(DonorReviewStatus)
  status?: DonorReviewStatus;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  take?: number;
}
