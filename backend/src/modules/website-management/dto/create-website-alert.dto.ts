import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BloodGroup, PriorityLevel } from '@prisma/client';

export class CreateWebsiteAlertDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(300)
  message!: string;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodType?: BloodGroup;

  @IsString()
  @MaxLength(120)
  hospitalName!: string;

  @IsEnum(PriorityLevel)
  urgencyLevel!: PriorityLevel;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  isSticky!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  isScrolling!: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
