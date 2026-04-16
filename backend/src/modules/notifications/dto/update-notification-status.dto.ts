import { IsBoolean, IsString } from 'class-validator';

export class UpdateNotificationStatusDto {
  @IsString()
  notificationId!: string;

  @IsBoolean()
  delivered!: boolean;
}
