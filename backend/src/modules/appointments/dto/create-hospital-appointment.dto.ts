import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateHospitalAppointmentDto {
  @IsString()
  donorId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

