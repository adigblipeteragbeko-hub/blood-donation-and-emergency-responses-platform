import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterHospitalProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  hospitalName!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  contactPhone!: string;
}

