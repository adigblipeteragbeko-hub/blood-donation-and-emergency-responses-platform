import { InventoryChangeType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryLogDto {
  @IsEnum(InventoryChangeType)
  changeType!: InventoryChangeType;

  @IsInt()
  @Min(0)
  unitsChanged!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
