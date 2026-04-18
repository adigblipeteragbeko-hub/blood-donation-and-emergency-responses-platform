import { IsString, Matches } from 'class-validator';

export class UpsertHospitalProfileDto {
  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Hospital name should contain letters only' })
  hospitalName!: string;

  @IsString()
  registrationCode!: string;

  @IsString()
  address!: string;

  @IsString()
  location!: string;

  @IsString()
  @Matches(/^[A-Za-z\s'-]+$/, { message: 'Contact name should contain letters only' })
  contactName!: string;

  @IsString()
  @Matches(/^\+\d{7,18}$/, { message: 'Contact phone must be digits with country code' })
  contactPhone!: string;
}
