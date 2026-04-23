import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsInt()
  @Min(0)
  availableUnits!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

