import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitHealthEligibilityDto {
  @IsNumber()
  @Min(0)
  @Max(300)
  weightKg!: number;

  @IsIn(['Yes', 'No'])
  hadFeverRecently!: 'Yes' | 'No';

  @IsIn(['Yes', 'No'])
  currentlyOnMedication!: 'Yes' | 'No';

  @IsIn(['Yes', 'No'])
  recentTravel!: 'Yes' | 'No';

  @IsOptional()
  @IsString()
  chronicCondition?: string;
}

