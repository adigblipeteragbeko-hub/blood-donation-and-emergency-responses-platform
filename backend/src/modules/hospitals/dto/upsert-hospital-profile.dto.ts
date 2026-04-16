import { IsString } from 'class-validator';

export class UpsertHospitalProfileDto {
  @IsString()
  hospitalName!: string;

  @IsString()
  registrationCode!: string;

  @IsString()
  address!: string;

  @IsString()
  location!: string;

  @IsString()
  contactName!: string;

  @IsString()
  contactPhone!: string;
}
