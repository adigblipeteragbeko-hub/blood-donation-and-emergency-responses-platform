import { IsString } from 'class-validator';

export class SendTestSmsDto {
  @IsString()
  phoneNumber!: string;
}
