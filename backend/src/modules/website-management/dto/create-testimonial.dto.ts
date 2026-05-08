import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTestimonialDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  role!: string;

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @Type(() => Boolean)
  @IsBoolean()
  isApproved!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  isPublished!: boolean;
}
