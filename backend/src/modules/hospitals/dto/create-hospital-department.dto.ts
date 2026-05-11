import { DepartmentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHospitalDepartmentDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(DepartmentType)
  type!: DepartmentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
