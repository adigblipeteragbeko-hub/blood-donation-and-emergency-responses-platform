import { BloodGroup } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class UpsertInventoryDto {
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @IsInt()
  @Min(0)
  availableUnits!: number;
}
