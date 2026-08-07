import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const declineReasons = ['Busy', 'Sick', 'Travelling', 'Personal Reason', 'Other'] as const;

export class DeclineAppointmentDto {
  @IsIn(declineReasons)
  reason!: typeof declineReasons[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
