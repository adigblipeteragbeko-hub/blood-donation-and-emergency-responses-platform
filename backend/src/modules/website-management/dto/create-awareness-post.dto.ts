import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateAwarenessPostDto {
  @IsString()
  @MaxLength(150)
  title!: string;

  @IsString()
  @MaxLength(6000)
  content!: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'image must be a valid URL' })
  image?: string;

  @IsString()
  @MaxLength(80)
  category!: string;

  @Type(() => Boolean)
  @IsBoolean()
  isPublished!: boolean;
}
