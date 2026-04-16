import { IsOptional, IsString } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
