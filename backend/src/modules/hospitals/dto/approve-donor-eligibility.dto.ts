import { IsBoolean } from 'class-validator';

export class ApproveDonorEligibilityDto {
  @IsBoolean()
  approved!: boolean;
}

