import { IsString, MaxLength } from 'class-validator';

export class UpdatePassportPhotoDto {
  @IsString()
  @MaxLength(2_500_000)
  passportPhotoUrl!: string;
}
