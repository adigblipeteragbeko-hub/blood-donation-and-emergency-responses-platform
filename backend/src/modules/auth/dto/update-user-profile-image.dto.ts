import { IsString, MaxLength } from 'class-validator';

export class UpdateUserProfileImageDto {
  @IsString()
  @MaxLength(2_500_000)
  profileImageUrl!: string;
}
