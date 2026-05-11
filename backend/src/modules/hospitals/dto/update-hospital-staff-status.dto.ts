import { StaffAccountStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateHospitalStaffStatusDto {
  @IsEnum(StaffAccountStatus)
  status!: StaffAccountStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
