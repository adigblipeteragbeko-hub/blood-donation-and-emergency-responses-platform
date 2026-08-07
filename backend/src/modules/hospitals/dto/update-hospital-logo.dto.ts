import { IsString, MaxLength } from 'class-validator';

export class UpdateHospitalLogoDto {
  @IsString()
  @MaxLength(2_500_000)
  logoUrl!: string;
}
