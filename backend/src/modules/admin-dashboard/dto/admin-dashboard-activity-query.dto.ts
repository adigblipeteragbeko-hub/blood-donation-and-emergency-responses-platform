import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminDashboardActivityQueryDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  take?: number;
}
