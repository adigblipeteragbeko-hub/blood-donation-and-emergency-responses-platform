import { IsBoolean } from 'class-validator';

export class UpdateDonorEligibilityApprovalDto {
  @IsBoolean()
  approved!: boolean;
}

