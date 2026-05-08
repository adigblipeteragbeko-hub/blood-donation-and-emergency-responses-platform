import { Type } from 'class-transformer';
import { BloodGroup, PriorityLevel } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWebsiteAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodType?: BloodGroup;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hospitalName?: string;

  @IsOptional()
  @IsEnum(PriorityLevel)
  urgencyLevel?: PriorityLevel;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSticky?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isScrolling?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
