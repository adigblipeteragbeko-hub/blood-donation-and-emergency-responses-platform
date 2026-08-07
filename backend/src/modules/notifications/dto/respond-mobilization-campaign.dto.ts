import { MobilizationResponseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondMobilizationCampaignDto {
  @IsString()
  campaignId!: string;

  @IsEnum(MobilizationResponseStatus)
  responseStatus!: MobilizationResponseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
