import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitsCollected?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  volumeCollectedMl?: number;

  @IsOptional()
  @IsString()
  donationNotes?: string;
}
