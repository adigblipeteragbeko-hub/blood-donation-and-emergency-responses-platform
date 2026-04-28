import { IsString } from 'class-validator';

export class UpdatePassportPhotoDto {
  @IsString()
  passportPhotoUrl!: string;
}

