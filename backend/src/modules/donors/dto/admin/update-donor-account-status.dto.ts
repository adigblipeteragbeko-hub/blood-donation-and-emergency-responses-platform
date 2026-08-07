import { IsBoolean } from 'class-validator';

export class UpdateDonorAccountStatusDto {
  @IsBoolean()
  active!: boolean;
}
