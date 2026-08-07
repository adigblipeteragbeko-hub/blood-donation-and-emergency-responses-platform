import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SixMonthReminderPreviewDto {
  @IsOptional()
  @IsString()
  donorId?: string;
}

export class SixMonthReminderTestDto {
  @IsString()
  donorId!: string;

  @IsBoolean()
  confirmSend!: boolean;
}
