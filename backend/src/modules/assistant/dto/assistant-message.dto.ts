import { BloodGroup } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssistantMessageDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsObject()
  context?: {
    bloodGroup?: BloodGroup;
    hospitalId?: string;
    lastIntent?: string;
  };
}

export class AssistantContextDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsString()
  hospitalId?: string;
}
