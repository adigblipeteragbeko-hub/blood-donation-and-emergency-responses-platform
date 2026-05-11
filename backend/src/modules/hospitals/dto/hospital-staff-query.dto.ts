import { Role, StaffAccountStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class HospitalStaffQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(StaffAccountStatus)
  status?: StaffAccountStatus;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
