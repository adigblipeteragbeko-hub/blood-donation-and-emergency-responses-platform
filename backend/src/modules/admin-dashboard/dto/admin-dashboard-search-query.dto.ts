import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminDashboardSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;

  @IsOptional()
  @IsString()
  type?: string;
}
