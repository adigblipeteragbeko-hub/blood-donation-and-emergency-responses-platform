import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDonationHistoryDto {
  @IsDateString()
  donatedAt!: string;

  @IsInt()
  @Min(1)
  unitsDonated!: number;

  @IsString()
  location!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
