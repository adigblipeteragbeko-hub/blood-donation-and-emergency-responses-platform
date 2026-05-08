import { Type } from 'class-transformer';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  @MaxLength(200)
  question!: string;

  @IsString()
  @MaxLength(2000)
  answer!: string;

  @Type(() => Boolean)
  @IsBoolean()
  isPublished!: boolean;
}
