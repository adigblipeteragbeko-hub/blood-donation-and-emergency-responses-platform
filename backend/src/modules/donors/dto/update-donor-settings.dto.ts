import { DonorProfileVisibility } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateDonorSettingsDto {
  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;

  @IsOptional()
  @IsEnum(DonorProfileVisibility)
  profileVisibility?: DonorProfileVisibility;
}
