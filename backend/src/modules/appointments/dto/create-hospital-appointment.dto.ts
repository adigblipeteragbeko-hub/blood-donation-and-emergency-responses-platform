import { AppointmentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateHospitalAppointmentDto {
  @IsString()
  donorId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @IsOptional()
  @IsString()
  bloodRequestId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
