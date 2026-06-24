import { AppointmentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  hospitalId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @IsOptional()
  @IsString()
  notes?: string;
}
