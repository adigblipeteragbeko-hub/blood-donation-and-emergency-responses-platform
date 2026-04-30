import { RequestProgressStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBloodRequestUpdateDto {
  @IsEnum(RequestProgressStatus)
  newStatus!: RequestProgressStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  transfusedByStaffId?: string;

  @IsOptional()
  @IsString()
  unitDin?: string;

  @IsOptional()
  @IsString()
  patientEncounterId?: string;
}
