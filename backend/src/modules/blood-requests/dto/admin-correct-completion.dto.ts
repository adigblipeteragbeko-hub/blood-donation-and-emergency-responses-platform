import { IsNotEmpty, IsString } from 'class-validator';

export class AdminCorrectCompletionDto {
  @IsString()
  @IsNotEmpty()
  transfusedByStaffId!: string;

  @IsString()
  @IsNotEmpty()
  unitDin!: string;

  @IsString()
  @IsNotEmpty()
  patientEncounterId!: string;

  @IsString()
  @IsNotEmpty()
  overrideReason!: string;
}

