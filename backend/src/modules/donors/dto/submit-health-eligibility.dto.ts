import { IsBoolean, IsObject, IsString } from 'class-validator';

export class SubmitHealthEligibilityDto {
  @IsString()
  selectedHospitalId!: string;

  @IsObject()
  personalInformation!: Record<string, unknown>;

  @IsObject()
  donationHistory!: Record<string, unknown>;

  @IsObject()
  replacementFamilyDonor!: Record<string, unknown>;

  @IsObject()
  healthQuestionnaire!: Record<string, unknown>;

  @IsBoolean()
  donorDeclarationAccepted!: boolean;
}
