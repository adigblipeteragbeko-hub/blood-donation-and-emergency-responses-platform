import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestAppointmentRescheduleDto {
  @IsDateString()
  preferredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
