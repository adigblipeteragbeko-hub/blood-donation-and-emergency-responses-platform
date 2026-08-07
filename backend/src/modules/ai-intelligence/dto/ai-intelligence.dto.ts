import { AiHandoffDestination, AiRiskLevel, BloodGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AiStockRiskQueryDto {
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsEnum(AiRiskLevel)
  riskLevel?: AiRiskLevel;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class AiDonorRecommendationQueryDto {
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minimumScore?: number;

  @IsOptional()
  @IsString()
  smsEnabledOnly?: string;
}

export class AiMobilizationPreviewDto {
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  recipientLimit?: number;
}

export class AiHandoffDto {
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  donorIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(480)
  suggestedMessage?: string;

  @IsEnum(AiHandoffDestination)
  destination!: AiHandoffDestination;
}
